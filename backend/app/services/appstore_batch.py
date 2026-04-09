from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any
import uuid

from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models import App, CrawlJob
from app.services.audit import log_audit
from app.services.formatters import normalize_analysis
from app.services.itunes import extract_privacy_policy_url, lookup_software, pick_best_match, search_software
from app.services.sanitize import sanitize_text, slugify_name

JOB_TYPE_ITUNES_BATCH = 'itunes_batch_lookup'
MAX_BATCH_ITEMS = 500
ALLOWED_COUNTRIES = {'cn', 'us', 'jp', 'hk'}

_WORKER_TASK: asyncio.Task | None = None
_STOP_EVENT: asyncio.Event | None = None


def _cuid_like() -> str:
    return uuid.uuid4().hex[:24]


def _empty_result_row(index: int, app_name: str, country: str) -> dict[str, Any]:
    return {
        'index': index,
        'appName': app_name,
        'country': country,
        'status': 'failed',
        'trackId': None,
        'trackName': '',
        'bundleId': '',
        'developerName': '',
        'privacyPolicyUrl': '',
        'trackViewUrl': '',
        'iconUrl': '',
        'genre': '',
        'errorCode': '',
        'errorMessage': '',
        'skippedExisting': False,
    }


def normalize_job_meta(meta: dict | None) -> dict[str, Any]:
    source = meta if isinstance(meta, dict) else {}
    input_block = source.get('input') if isinstance(source.get('input'), dict) else {}
    progress = source.get('progress') if isinstance(source.get('progress'), dict) else {}
    results = source.get('results') if isinstance(source.get('results'), list) else []
    failed_names = source.get('failedAppNames') if isinstance(source.get('failedAppNames'), list) else []

    app_names = []
    for item in input_block.get('appNames', []):
        if isinstance(item, str) and item.strip():
            app_names.append(item.strip())

    total = int(progress.get('total') or len(app_names) or 0)
    processed = int(progress.get('processed') or 0)
    success = int(progress.get('success') or 0)
    failed = int(progress.get('failed') or 0)
    percent = int(progress.get('percent') or 0)

    return {
        'input': {
            'appNames': app_names,
            'country': str(input_block.get('country') or 'cn').lower(),
            'persistDraft': bool(input_block.get('persistDraft') or False),
            'requestedBy': str(input_block.get('requestedBy') or 'admin'),
            'total': total,
        },
        'progress': {
            'total': total,
            'processed': processed,
            'success': success,
            'failed': failed,
            'percent': percent,
            'state': str(progress.get('state') or 'queued'),
            'currentAppName': str(progress.get('currentAppName') or ''),
        },
        'results': results,
        'failedAppNames': [str(item) for item in failed_names if str(item).strip()],
        'stopRequested': bool(source.get('stopRequested') or False),
    }


def build_initial_meta(
    *,
    app_names: list[str],
    country: str,
    persist_draft: bool,
    requested_by: str,
) -> dict[str, Any]:
    normalized_names = [name.strip() for name in app_names if name.strip()]
    return {
        'input': {
            'appNames': normalized_names,
            'country': country.lower(),
            'persistDraft': persist_draft,
            'requestedBy': requested_by,
            'total': len(normalized_names),
        },
        'progress': {
            'total': len(normalized_names),
            'processed': 0,
            'success': 0,
            'failed': 0,
            'percent': 0,
            'state': 'queued',
            'currentAppName': '',
        },
        'results': [],
        'failedAppNames': [],
        'stopRequested': False,
    }


def _ensure_unique_slug(db, base_slug: str) -> str:
    slug = base_slug or 'app'
    suffix = 2
    while db.query(App).filter(App.slug == slug).first():
        slug = f'{base_slug}-{suffix}'
        suffix += 1
    return slug


def _default_analysis_for_draft() -> dict[str, Any]:
    return {
        'risk_level': 'medium',
        'one_liner': '仅完成 App Store 元数据抓取，待补充隐私政策分析。',
        'key_findings': ['当前结果仅含 App Store 基础信息，尚未完成隐私条款解析。'],
        'plain_summary': '请补充隐私政策文本后再执行完整分析。',
        'data_collected': [],
        'data_shared_with': [],
        'user_rights': [],
        'dispute': '具体条款以官方隐私政策原文为准。',
    }


def _persist_as_draft(db, row: dict[str, Any], requested_by: str) -> dict[str, Any]:
    name = sanitize_text(row.get('trackName') or row.get('appName') or '', max_len=120)
    if not name:
        row['skippedExisting'] = True
        row['errorCode'] = 'EMPTY_APP_NAME'
        row['errorMessage'] = '缺少可用应用名称，跳过草稿入库'
        return row

    slug_base = slugify_name(name) or slugify_name(row.get('appName') or '') or f"app-{row.get('trackId') or 'unknown'}"
    if db.query(App).filter(App.name == name).first() or db.query(App).filter(App.slug == slug_base).first():
        row['skippedExisting'] = True
        row['errorCode'] = 'SKIPPED_EXISTING'
        row['errorMessage'] = '已存在同名或同 slug 应用，跳过入库'
        return row

    now = datetime.utcnow()
    analysis_data = _default_analysis_for_draft()
    normalized = normalize_analysis(analysis_data)
    app = App(
        id=_cuid_like(),
        slug=_ensure_unique_slug(db, slug_base),
        name=name,
        category=sanitize_text(row.get('genre') or '待分类', max_len=80) or '待分类',
        developer=sanitize_text(row.get('developerName') or '', max_len=120) or None,
        iconUrl=sanitize_text(row.get('iconUrl') or '', max_len=2000) or None,
        privacyPolicyUrl=sanitize_text(row.get('privacyPolicyUrl') or '', max_len=2000) or None,
        termsOfServiceUrl=None,
        rawText=None,
        analysis=analysis_data,
        analysisSource=analysis_data,
        riskLevel=normalized['riskLevel'],
        oneLiner=normalized['oneLiner'],
        plainSummary=normalized['plainSummary'],
        status='draft',
        reviewNotes='',
        featured=False,
        warningPinned=False,
        isPublished=False,
        sourceType='itunes_batch',
        sourceSubmissionId=None,
        analyzedAt=now,
        updatedAt=now,
        createdAt=now,
        contentHash=None,
        lastFetchAt=now,
        lastError=None,
    )

    try:
        db.add(app)
        db.commit()
    except IntegrityError:
        db.rollback()
        row['skippedExisting'] = True
        row['errorCode'] = 'SKIPPED_EXISTING'
        row['errorMessage'] = '应用已存在（唯一键冲突），跳过入库'
        return row

    log_audit(
        db,
        entity_type='app',
        entity_id=app.id,
        app_id=app.id,
        action='tool.appstore_batch_saved_draft',
        actor=requested_by or 'system',
        before=None,
        after={'name': app.name, 'slug': app.slug, 'sourceType': 'itunes_batch'},
    )

    row['savedAppId'] = app.id
    return row


async def _lookup_one(index: int, app_name: str, country: str) -> dict[str, Any]:
    row = _empty_result_row(index, app_name, country)
    try:
        results = await search_software(app_name, country=country, limit=5)
        best = pick_best_match(results, app_name)
        if not best:
            row['errorCode'] = 'NO_MATCH'
            row['errorMessage'] = '未找到匹配 App'
            return row

        track_id = best.get('trackId')
        if not track_id:
            row['errorCode'] = 'NO_TRACK_ID'
            row['errorMessage'] = '匹配结果缺少 trackId'
            return row

        try:
            track_id = int(track_id)
        except Exception:
            row['errorCode'] = 'INVALID_TRACK_ID'
            row['errorMessage'] = 'trackId 无效'
            return row

        detail = await lookup_software(track_id, country=country) or best
        track_name = sanitize_text(detail.get('trackName') or best.get('trackName') or app_name, max_len=120)
        developer_name = sanitize_text(detail.get('sellerName') or detail.get('artistName') or '', max_len=120)
        bundle_id = sanitize_text(detail.get('bundleId') or '', max_len=160)
        track_view_url = sanitize_text(detail.get('trackViewUrl') or best.get('trackViewUrl') or '', max_len=2000)
        privacy_url = sanitize_text(detail.get('privacyPolicyUrl') or best.get('privacyPolicyUrl') or '', max_len=2000)

        if not privacy_url and track_view_url:
            try:
                extracted_url = await extract_privacy_policy_url(track_view_url, country=country)
                privacy_url = sanitize_text(extracted_url or '', max_len=2000)
            except Exception:
                privacy_url = ''

        row.update(
            {
                'status': 'success',
                'trackId': track_id,
                'trackName': track_name,
                'bundleId': bundle_id,
                'developerName': developer_name,
                'privacyPolicyUrl': privacy_url,
                'trackViewUrl': track_view_url,
                'iconUrl': sanitize_text(
                    detail.get('artworkUrl512') or detail.get('artworkUrl100') or best.get('artworkUrl100') or '',
                    max_len=2000,
                ),
                'genre': sanitize_text(detail.get('primaryGenreName') or best.get('primaryGenreName') or '', max_len=80),
                'errorCode': '',
                'errorMessage': '',
            }
        )
        return row
    except Exception as error:
        row['errorCode'] = 'LOOKUP_FAILED'
        row['errorMessage'] = sanitize_text(str(error), max_len=300)
        return row


def _is_terminal(status: str) -> bool:
    return status in {'success', 'failed', 'stopped'}


async def _run_single_job(job_id: str):
    db = SessionLocal()
    try:
        job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
        if not job:
            return

        meta = normalize_job_meta(job.meta)
        app_names = meta['input']['appNames']
        country = meta['input']['country']
        persist_draft = bool(meta['input']['persistDraft'])
        requested_by = meta['input']['requestedBy'] or 'admin'
        total = len(app_names)

        if total == 0:
            job.status = 'failed'
            job.finishedAt = datetime.utcnow()
            meta['progress'].update({'state': 'failed', 'total': 0, 'processed': 0, 'success': 0, 'failed': 0, 'percent': 0})
            job.meta = meta
            job.summary = '任务输入为空'
            db.commit()
            return

        processed_start = int(meta['progress'].get('processed') or 0)
        existing_results = meta.get('results', [])
        if len(existing_results) > processed_start:
            processed_start = len(existing_results)
        processed_start = max(0, min(total, processed_start))

        for index, app_name in enumerate(app_names[processed_start:], start=processed_start + 1):
            db.refresh(job)
            meta = normalize_job_meta(job.meta)

            if meta.get('stopRequested'):
                job.status = 'stopped'
                meta['progress']['state'] = 'stopped'
                meta['progress']['currentAppName'] = ''
                job.meta = meta
                job.finishedAt = datetime.utcnow()
                job.summary = (
                    f"total={total}, processed={meta['progress']['processed']}, "
                    f"success={meta['progress']['success']}, failed={meta['progress']['failed']}, stopped=true"
                )
                db.commit()
                return

            row = await _lookup_one(index, app_name, country)
            if row['status'] == 'success' and persist_draft:
                row = _persist_as_draft(db, row, requested_by)

            meta['results'].append(row)
            if row['status'] == 'success':
                meta['progress']['success'] += 1
            else:
                meta['progress']['failed'] += 1
                if app_name not in meta['failedAppNames']:
                    meta['failedAppNames'].append(app_name)

            meta['progress']['processed'] = index
            meta['progress']['total'] = total
            meta['progress']['percent'] = int(index * 100 / total)
            meta['progress']['state'] = 'running'
            meta['progress']['currentAppName'] = app_name

            job.meta = meta
            db.commit()

        db.refresh(job)
        meta = normalize_job_meta(job.meta)
        failed_count = int(meta['progress']['failed'])
        job.status = 'failed' if failed_count > 0 else 'success'
        meta['progress']['state'] = job.status
        meta['progress']['currentAppName'] = ''
        meta['progress']['percent'] = 100
        job.meta = meta
        job.finishedAt = datetime.utcnow()
        job.summary = (
            f"total={meta['progress']['total']}, processed={meta['progress']['processed']}, "
            f"success={meta['progress']['success']}, failed={meta['progress']['failed']}"
        )
        db.commit()
    except Exception as error:
        db.rollback()
        try:
            job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
            if job:
                meta = normalize_job_meta(job.meta)
                meta['progress']['state'] = 'failed'
                meta['progress']['currentAppName'] = ''
                job.meta = meta
                job.status = 'failed'
                job.finishedAt = datetime.utcnow()
                job.summary = sanitize_text(str(error), max_len=300)
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()


async def _process_next_job() -> bool:
    db = SessionLocal()
    try:
        job = (
            db.query(CrawlJob)
            .filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH, CrawlJob.status == 'queued')
            .order_by(CrawlJob.startedAt.asc(), CrawlJob.id.asc())
            .first()
        )
        if not job:
            return False

        meta = normalize_job_meta(job.meta)
        meta['progress']['state'] = 'running'
        job.status = 'running'
        job.startedAt = datetime.utcnow()
        job.summary = '批量抓取进行中'
        job.meta = meta
        db.commit()
        selected_job_id = job.id
    finally:
        db.close()

    await _run_single_job(selected_job_id)
    return True


async def _worker_loop():
    global _STOP_EVENT
    if _STOP_EVENT is None:
        _STOP_EVENT = asyncio.Event()

    while not _STOP_EVENT.is_set():
        try:
            handled = await _process_next_job()
            if not handled:
                await asyncio.sleep(0.8)
        except asyncio.CancelledError:
            raise
        except Exception:
            await asyncio.sleep(1.0)


def recover_stuck_jobs():
    db = SessionLocal()
    try:
        jobs = db.query(CrawlJob).filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH, CrawlJob.status == 'running').all()
        if not jobs:
            return

        for job in jobs:
            meta = normalize_job_meta(job.meta)
            meta['progress']['state'] = 'queued'
            meta['progress']['currentAppName'] = ''
            job.meta = meta
            job.status = 'queued'
            job.summary = '服务重启后恢复队列'
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def start_appstore_batch_worker():
    global _WORKER_TASK, _STOP_EVENT
    if _WORKER_TASK and not _WORKER_TASK.done():
        return
    _STOP_EVENT = asyncio.Event()
    recover_stuck_jobs()
    _WORKER_TASK = asyncio.create_task(_worker_loop())


async def stop_appstore_batch_worker():
    global _WORKER_TASK, _STOP_EVENT
    if _STOP_EVENT:
        _STOP_EVENT.set()
    if _WORKER_TASK:
        _WORKER_TASK.cancel()
        try:
            await _WORKER_TASK
        except BaseException:
            pass
    _WORKER_TASK = None
    _STOP_EVENT = None


def get_batch_job_payload(job: CrawlJob) -> dict[str, Any]:
    meta = normalize_job_meta(job.meta)
    retryable = _is_terminal(job.status) and len(meta.get('failedAppNames', [])) > 0
    return {
        'id': job.id,
        'type': job.type,
        'status': job.status,
        'startedAt': job.startedAt.isoformat() if job.startedAt else None,
        'finishedAt': job.finishedAt.isoformat() if job.finishedAt else None,
        'summary': job.summary or '',
        'progress': meta['progress'],
        'results': meta['results'],
        'failedAppNames': meta['failedAppNames'],
        'retryable': retryable,
    }
