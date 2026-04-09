from datetime import datetime
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import require_admin
from app.db.session import get_db
from app.models import App, AuditLog, CrawlJob, PolicyVersion, UserSubmission, AppealTicket
from app.services.analysis import analyze_policy_text, contains_deterministic_legal_terms
from app.services.appstore_batch import (
    ALLOWED_COUNTRIES,
    JOB_TYPE_ITUNES_BATCH,
    MAX_BATCH_ITEMS,
    build_initial_meta,
    get_batch_job_payload,
    normalize_job_meta,
)
from app.services.apk_analyzer import analyze_apk_binary
from app.services.audit import log_audit
from app.services.formatters import normalize_analysis, to_date_label
from app.services.jobs import create_job, run_job
from app.services.mailer import send_appeal_status_email
from app.services.policy_fetcher import fetch_policy_text, hash_text
from app.services.sanitize import sanitize_list, sanitize_text, slugify_name
from app.services.serialize import model_to_dict
from app.services.site_settings import get_site_settings, update_site_settings
from app.services.workflow import process_submission

router = APIRouter(prefix='/admin', tags=['admin'])

APPEAL_STATUS_LABELS = {
    'pending': '待处理',
    'processing': '处理中',
    'resolved': '已解决',
    'rejected': '已驳回',
}

APPEAL_ISSUE_TYPE_LABELS = {
    'inaccurate_info': '信息不准确',
    'infringement': '侵权投诉',
    'outdated_content': '内容过期/滞后',
    'other': '其他问题',
}


def cuid_like() -> str:
    return uuid.uuid4().hex[:24]


def _ensure_unique_slug(db: Session, base_slug: str) -> str:
    slug = base_slug or 'app'
    index = 2
    while db.query(App).filter(App.slug == slug).first():
        slug = f'{base_slug}-{index}'
        index += 1
    return slug


def _delete_app_with_dependencies(db: Session, app_id: str):
    db.query(PolicyVersion).filter(PolicyVersion.appId == app_id).delete(synchronize_session=False)
    db.query(AuditLog).filter(AuditLog.appId == app_id).update({AuditLog.appId: None}, synchronize_session=False)
    db.query(UserSubmission).filter(UserSubmission.linkedAppId == app_id).update({UserSubmission.linkedAppId: None}, synchronize_session=False)
    db.query(App).filter(App.id == app_id).delete(synchronize_session=False)


def _as_text_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_tool_analysis(analysis: dict | None) -> dict:
    source = analysis or {}
    risk_level = sanitize_text(str(source.get('risk_level') or source.get('riskLevel') or 'medium'), max_len=20).lower()
    if risk_level not in {'low', 'medium', 'high', 'critical'}:
        risk_level = 'medium'

    return {
        'risk_level': risk_level,
        'one_liner': sanitize_text(source.get('one_liner') or source.get('oneLiner') or '自动分析结果，请人工复核。', max_len=120),
        'key_findings': sanitize_list(
            _as_text_list(source.get('key_findings') or source.get('keyFindings')),
            max_len=200,
        )[:5],
        'plain_summary': sanitize_text(
            source.get('plain_summary') or source.get('plainSummary') or '暂无摘要，请结合原文进一步核对。',
            max_len=600,
        ),
        'data_collected': sanitize_list(_as_text_list(source.get('data_collected') or source.get('dataCollected')), max_len=120),
        'data_shared_with': sanitize_list(
            _as_text_list(source.get('data_shared_with') or source.get('dataSharedWith')),
            max_len=120,
        ),
        'user_rights': sanitize_list(_as_text_list(source.get('user_rights') or source.get('userRights')), max_len=120),
        'dispute': sanitize_text(source.get('dispute') or '如与官方政策存在冲突，请以官方条款为准。', max_len=300),
    }


class PolicyAnalyzeInput(BaseModel):
    appName: str
    policyUrl: str | None = None
    rawText: str | None = None


@router.post('/tools/analyzer/policy-analyze')
async def tool_policy_analyze(payload: PolicyAnalyzeInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app_name = sanitize_text(payload.appName, max_len=120)
    policy_url = sanitize_text(payload.policyUrl, max_len=2000)
    raw_text = sanitize_text(payload.rawText, max_len=400000)

    if not app_name:
        raise AppError(400, 'APP_NAME_REQUIRED', '请填写 App 名称')
    if not raw_text and not policy_url:
        raise AppError(400, 'POLICY_INPUT_REQUIRED', '请提供隐私政策 URL 或隐私政策文本')

    content_hash = ''
    if raw_text:
        analyzed_text = raw_text
        content_hash = hash_text(analyzed_text)
    else:
        fetched = await fetch_policy_text(policy_url)
        analyzed_text = fetched['text']
        content_hash = fetched['contentHash']

    analysis = await analyze_policy_text(analyzed_text)
    normalized = normalize_analysis(analysis)

    log_audit(
        db,
        entity_type='tool',
        entity_id=cuid_like(),
        action='tool.policy_analyzed',
        actor=admin['username'],
        before=None,
        after={
            'appName': app_name,
            'policyUrl': policy_url or None,
            'contentHash': content_hash,
            'riskLevel': normalized['riskLevel'],
        },
    )

    return {
        'ok': True,
        'sourceType': 'policy',
        'appName': app_name,
        'policyUrl': policy_url or None,
        'rawText': analyzed_text,
        'analysis': analysis,
        'normalized': normalized,
        'meta': {'textLength': len(analyzed_text), 'contentHash': content_hash},
    }


@router.post('/tools/analyzer/apk-analyze')
async def tool_apk_analyze(request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)):
    admin = require_admin(request)
    filename = file.filename or 'upload.apk'
    if not filename.lower().endswith('.apk'):
        raise AppError(400, 'INVALID_APK_FILE', '仅支持 .apk 文件')

    content = await file.read()
    await file.close()
    max_bytes = settings.apk_max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise AppError(400, 'APK_TOO_LARGE', f'APK 文件大小超过 {settings.apk_max_upload_mb}MB 限制')

    parsed = analyze_apk_binary(content, filename)
    normalized = normalize_analysis(parsed['analysis'])

    log_audit(
        db,
        entity_type='tool',
        entity_id=cuid_like(),
        action='tool.apk_analyzed',
        actor=admin['username'],
        before=None,
        after={
            'appName': parsed['appName'],
            'packageName': parsed['apkMeta'].get('packageName'),
            'riskLevel': normalized['riskLevel'],
        },
    )

    return {
        'ok': True,
        'sourceType': 'apk',
        'appName': parsed['appName'],
        'analysis': parsed['analysis'],
        'normalized': normalized,
        'apkMeta': parsed['apkMeta'],
    }


class SaveDraftInput(BaseModel):
    sourceType: Literal['policy', 'apk']
    appName: str
    analysis: dict
    rawText: str | None = None
    policyUrl: str | None = None
    apkMeta: dict | None = None


@router.post('/tools/analyzer/save-draft')
def tool_save_draft(payload: SaveDraftInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app_name = sanitize_text(payload.appName, max_len=120)
    if not app_name:
        raise AppError(400, 'APP_NAME_REQUIRED', '请填写 App 名称')
    if db.query(App).filter(App.name == app_name).first():
        raise AppError(409, 'APP_ALREADY_EXISTS', '同名 App 已存在，请修改名称后再保存')

    normalized_analysis = _normalize_tool_analysis(payload.analysis)
    normalized = normalize_analysis(normalized_analysis)
    source_type = 'apk_tool' if payload.sourceType == 'apk' else 'manual'
    raw_text = sanitize_text(payload.rawText, max_len=400000)
    policy_url = sanitize_text(payload.policyUrl, max_len=2000)
    apk_meta = payload.apkMeta or {}
    now = datetime.utcnow()

    slug = _ensure_unique_slug(db, slugify_name(app_name))
    app = App(
        id=cuid_like(),
        slug=slug,
        name=app_name,
        category=sanitize_text(str(apk_meta.get('category') or '待分类'), max_len=80),
        developer=sanitize_text(str(apk_meta.get('developer') or ''), max_len=120) or None,
        privacyPolicyUrl=policy_url or None,
        rawText=raw_text or None,
        analysis=normalized_analysis,
        analysisSource=normalized_analysis,
        riskLevel=normalized['riskLevel'],
        oneLiner=normalized['oneLiner'],
        plainSummary=normalized['plainSummary'],
        status='draft',
        isPublished=False,
        featured=False,
        warningPinned=False,
        sourceType=source_type,
        contentHash=hash_text(raw_text) if raw_text else None,
        analyzedAt=now,
        updatedAt=now,
        createdAt=now,
    )
    db.add(app)
    db.flush()

    if raw_text:
        db.add(
            PolicyVersion(
                id=cuid_like(),
                appId=app.id,
                versionLabel=f"Tool Draft {now.strftime('%Y-%m-%d')}",
                rawText=raw_text,
                contentHash=app.contentHash or hash_text(raw_text),
                analysis=normalized_analysis,
                sourceUrl=policy_url or None,
                createdAt=now,
            )
        )

    db.commit()
    db.refresh(app)

    log_audit(
        db,
        entity_type='tool',
        entity_id=app.id,
        app_id=app.id,
        action='tool.saved_draft',
        actor=admin['username'],
        before=None,
        after={'sourceType': payload.sourceType, 'slug': app.slug, 'status': app.status},
    )

    return {'ok': True, 'app': model_to_dict(app)}


class AppStoreBatchCreateInput(BaseModel):
    appNames: list[str] = Field(min_length=1, max_length=MAX_BATCH_ITEMS)
    country: str = 'cn'
    persistDraft: bool = False


@router.post('/tools/appstore-id/jobs')
def create_appstore_batch_job(payload: AppStoreBatchCreateInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)

    country = sanitize_text(payload.country, max_len=8).lower()
    if country not in ALLOWED_COUNTRIES:
        raise AppError(400, 'INVALID_COUNTRY', f"country 仅支持: {', '.join(sorted(ALLOWED_COUNTRIES))}")

    cleaned_names = []
    seen = set()
    for raw_name in payload.appNames:
        name = sanitize_text(raw_name, max_len=120)
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned_names.append(name)

    if not cleaned_names:
        raise AppError(400, 'APP_NAMES_REQUIRED', '请至少提供一个有效 App 名称')
    if len(cleaned_names) > MAX_BATCH_ITEMS:
        raise AppError(400, 'APP_NAMES_TOO_MANY', f'单次最多 {MAX_BATCH_ITEMS} 条 App 名称')

    meta = build_initial_meta(
        app_names=cleaned_names,
        country=country,
        persist_draft=payload.persistDraft,
        requested_by=admin['username'],
    )
    job = create_job(db, JOB_TYPE_ITUNES_BATCH, 'appstore_batch', None, meta)

    log_audit(
        db,
        entity_type='job',
        entity_id=job.id,
        action='tool.appstore_batch_job_created',
        actor=admin['username'],
        before=None,
        after={
            'jobId': job.id,
            'total': len(cleaned_names),
            'country': country,
            'persistDraft': bool(payload.persistDraft),
        },
    )
    return {'ok': True, 'jobId': job.id}


def _attach_batch_queue_info(db: Session, payload: dict) -> dict:
    queued_ids = [
        item[0]
        for item in db.query(CrawlJob.id)
        .filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH, CrawlJob.status == 'queued')
        .order_by(CrawlJob.startedAt.asc(), CrawlJob.id.asc())
        .all()
    ]
    running = (
        db.query(CrawlJob)
        .filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH, CrawlJob.status == 'running')
        .order_by(CrawlJob.startedAt.asc(), CrawlJob.id.asc())
        .first()
    )

    if payload['status'] == 'queued':
        position = queued_ids.index(payload['id']) + 1 if payload['id'] in queued_ids else None
        ahead = (position - 1 if position else 0) + (1 if running else 0)
        payload['queue'] = {
            'position': position,
            'queuedTotal': len(queued_ids),
            'ahead': ahead,
            'runningJobId': running.id if running else None,
        }
    elif payload['status'] == 'running':
        payload['queue'] = {
            'position': 0,
            'queuedTotal': len(queued_ids),
            'ahead': 0,
            'runningJobId': payload['id'],
        }
    else:
        payload['queue'] = {
            'position': None,
            'queuedTotal': len(queued_ids),
            'ahead': 0,
            'runningJobId': running.id if running else None,
        }
    return payload


@router.get('/tools/appstore-id/jobs-history')
def get_appstore_batch_jobs_history(request: Request, limit: int = 30, db: Session = Depends(get_db)):
    require_admin(request)
    take = min(max(limit, 1), 100)
    jobs = (
        db.query(CrawlJob)
        .filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH)
        .order_by(CrawlJob.startedAt.desc(), CrawlJob.id.desc())
        .limit(take)
        .all()
    )

    items = []
    for job in jobs:
        payload = get_batch_job_payload(job)
        progress = payload.get('progress', {}) or {}
        items.append(
            {
                'id': payload['id'],
                'status': payload['status'],
                'startedAt': payload['startedAt'],
                'finishedAt': payload['finishedAt'],
                'summary': payload.get('summary') or '',
                'progress': progress,
                'resultCount': len(payload.get('results', [])),
                'failedCount': len(payload.get('failedAppNames', [])),
                'retryable': bool(payload.get('retryable')),
            }
        )
    return {'ok': True, 'items': items}


@router.get('/tools/appstore-id/jobs/{job_id}')
def get_appstore_batch_job(job_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id, CrawlJob.type == JOB_TYPE_ITUNES_BATCH).first()
    if not job:
        raise AppError(404, 'JOB_NOT_FOUND', '任务不存在')
    payload = _attach_batch_queue_info(db, get_batch_job_payload(job))
    return {'ok': True, 'job': payload}


@router.get('/tools/appstore-id/jobs-latest')
def get_latest_appstore_batch_job(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    active = (
        db.query(CrawlJob)
        .filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH, CrawlJob.status.in_(['queued', 'running']))
        .order_by(CrawlJob.startedAt.desc(), CrawlJob.id.desc())
        .first()
    )
    if active:
        return {'ok': True, 'job': get_batch_job_payload(active)}

    latest = (
        db.query(CrawlJob)
        .filter(CrawlJob.type == JOB_TYPE_ITUNES_BATCH)
        .order_by(CrawlJob.startedAt.desc(), CrawlJob.id.desc())
        .first()
    )
    if not latest:
        return {'ok': True, 'job': None}
    payload = _attach_batch_queue_info(db, get_batch_job_payload(latest))
    return {'ok': True, 'job': payload}


@router.post('/tools/appstore-id/jobs/{job_id}/stop')
def stop_appstore_batch_job(job_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id, CrawlJob.type == JOB_TYPE_ITUNES_BATCH).first()
    if not job:
        raise AppError(404, 'JOB_NOT_FOUND', '任务不存在')
    if job.status not in {'queued', 'running'}:
        raise AppError(400, 'JOB_NOT_STOPPABLE', '仅 queued/running 任务可停止')

    meta = normalize_job_meta(job.meta)
    meta['stopRequested'] = True

    if job.status == 'queued':
        meta['progress']['state'] = 'stopped'
        meta['progress']['currentAppName'] = ''
        job.status = 'stopped'
        job.finishedAt = datetime.utcnow()
        job.summary = '任务在执行前被停止'

    job.meta = meta
    db.commit()

    log_audit(
        db,
        entity_type='job',
        entity_id=job.id,
        action='tool.appstore_batch_job_stopped',
        actor=admin['username'],
        before=None,
        after={'jobId': job.id, 'status': job.status},
    )
    return {'ok': True}


@router.post('/tools/appstore-id/jobs/{job_id}/retry-failed')
def retry_failed_appstore_batch_job(job_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    source = db.query(CrawlJob).filter(CrawlJob.id == job_id, CrawlJob.type == JOB_TYPE_ITUNES_BATCH).first()
    if not source:
        raise AppError(404, 'JOB_NOT_FOUND', '任务不存在')

    source_meta = normalize_job_meta(source.meta)
    failed_app_names = [sanitize_text(item, max_len=120) for item in source_meta.get('failedAppNames', [])]
    failed_app_names = [item for item in failed_app_names if item]
    if not failed_app_names:
        raise AppError(400, 'NO_FAILED_ITEMS', '该任务没有可重试的失败项')

    retry_meta = build_initial_meta(
        app_names=failed_app_names,
        country=source_meta['input']['country'],
        persist_draft=bool(source_meta['input']['persistDraft']),
        requested_by=admin['username'],
    )
    retry_job = create_job(db, JOB_TYPE_ITUNES_BATCH, 'appstore_batch', None, retry_meta)

    log_audit(
        db,
        entity_type='job',
        entity_id=retry_job.id,
        action='tool.appstore_batch_job_retry_failed',
        actor=admin['username'],
        before={'sourceJobId': source.id},
        after={'jobId': retry_job.id, 'failedCount': len(failed_app_names)},
    )
    return {'ok': True, 'jobId': retry_job.id}


@router.get('/submissions')
def admin_submissions(
    request: Request,
    status: str = '',
    fetchStatus: str = '',
    analysisStatus: str = '',
    q: str = '',
    page: int = 1,
    pageSize: int = 20,
    db: Session = Depends(get_db),
):
    require_admin(request)
    page = max(page, 1)
    pageSize = min(max(pageSize, 1), 100)

    query = db.query(UserSubmission)
    if status:
        query = query.filter(UserSubmission.status == status)
    if fetchStatus:
        query = query.filter(UserSubmission.fetchStatus == fetchStatus)
    if analysisStatus:
        query = query.filter(UserSubmission.analysisStatus == analysisStatus)
    if q:
        keyword = f'%{q.strip()}%'
        query = query.filter(
            or_(
                UserSubmission.appName.like(keyword),
                UserSubmission.privacyUrl.like(keyword),
                UserSubmission.submitterEmail.like(keyword),
            )
        )

    total = query.count()
    items = query.order_by(UserSubmission.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
    return {
        'page': page,
        'pageSize': pageSize,
        'total': total,
        'items': [
            {
                **model_to_dict(item),
                'createdAtLabel': to_date_label(item.createdAt),
                'updatedAtLabel': to_date_label(item.updatedAt),
            }
            for item in items
        ],
    }


@router.get('/submissions/{submission_id}')
def submission_detail(submission_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    submission = db.query(UserSubmission).filter(UserSubmission.id == submission_id).first()
    if not submission:
        raise AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在')
    linked_app = db.query(App).filter(App.id == submission.linkedAppId).first() if submission.linkedAppId else None
    return {
        'submission': {
            **model_to_dict(submission),
            'createdAtLabel': to_date_label(submission.createdAt),
            'updatedAtLabel': to_date_label(submission.updatedAt),
        },
        'linkedApp': model_to_dict(linked_app),
    }


class AdminNoteInput(BaseModel):
    adminNote: str | None = ''


@router.post('/submissions/{submission_id}/process')
async def submission_process(submission_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    submission = db.query(UserSubmission).filter(UserSubmission.id == submission_id).first()
    if not submission:
        raise AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在')
    if submission.status == 'processing':
        raise AppError(409, 'SUBMISSION_ALREADY_PROCESSING', '该提交正在处理中，请稍后刷新')

    job = create_job(db, 'submission_process', 'submission', submission_id)

    async def _work():
        return await process_submission(db, submission_id)

    try:
        app = await run_job(db, job.id, _work, '处理提交并生成分析')
    except Exception as error:
        raise AppError(400, 'SUBMISSION_PROCESS_FAILED', str(error), {'submissionId': submission_id, 'jobId': job.id})

    return {'ok': True, 'app': model_to_dict(app)}


@router.post('/submissions/{submission_id}/approve')
def submission_approve(submission_id: str, payload: AdminNoteInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    submission = db.query(UserSubmission).filter(UserSubmission.id == submission_id).first()
    if not submission:
        raise AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在')
    if not submission.linkedAppId:
        raise AppError(400, 'APP_NOT_READY', '尚未关联 App，无法通过审核')

    app = db.query(App).filter(App.id == submission.linkedAppId).first()
    if not app or not app.analysis or not app.riskLevel or not app.oneLiner or not app.plainSummary:
        raise AppError(400, 'ANALYSIS_INCOMPLETE', '关联 App 的分析结果不完整')

    note = sanitize_text(payload.adminNote)
    app.status = 'published'
    app.isPublished = True
    app.reviewNotes = note or None
    submission.status = 'approved'
    submission.adminNote = note
    submission.approvedAt = datetime.utcnow()
    db.commit()

    log_audit(
        db,
        entity_type='submission',
        entity_id=submission_id,
        app_id=submission.linkedAppId,
        action='submission.approved',
        actor=admin['username'],
        before={'status': 'review_ready'},
        after={'status': submission.status},
    )
    return {'ok': True}


@router.post('/submissions/{submission_id}/reject')
def submission_reject(submission_id: str, payload: AdminNoteInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    submission = db.query(UserSubmission).filter(UserSubmission.id == submission_id).first()
    if not submission:
        raise AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在')

    before = {'status': submission.status, 'adminNote': submission.adminNote}
    submission.status = 'rejected'
    submission.adminNote = sanitize_text(payload.adminNote)
    db.commit()

    log_audit(
        db,
        entity_type='submission',
        entity_id=submission_id,
        app_id=submission.linkedAppId,
        action='submission.rejected',
        actor=admin['username'],
        before=before,
        after={'status': submission.status, 'adminNote': submission.adminNote},
    )
    return {'ok': True}


@router.post('/submissions/{submission_id}/send-back')
def submission_send_back(submission_id: str, payload: AdminNoteInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    note = sanitize_text(payload.adminNote)
    if not note:
        raise AppError(400, 'ADMIN_NOTE_REQUIRED', '退回补充信息时，审核备注不能为空')

    submission = db.query(UserSubmission).filter(UserSubmission.id == submission_id).first()
    if not submission:
        raise AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在')

    before = {'status': submission.status, 'adminNote': submission.adminNote}
    submission.status = 'needs_revision'
    submission.adminNote = note
    submission.approvedAt = None
    db.commit()

    log_audit(
        db,
        entity_type='submission',
        entity_id=submission_id,
        app_id=submission.linkedAppId,
        action='submission.sent_back',
        actor=admin['username'],
        before=before,
        after={'status': submission.status, 'adminNote': submission.adminNote},
    )
    return {'ok': True}


class SubmissionBulkInput(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    action: Literal['process', 'approve', 'reject', 'send_back']
    adminNote: str | None = ''


@router.post('/submissions/bulk-action')
async def submissions_bulk(payload: SubmissionBulkInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    batch_id = f'submission-{uuid.uuid4().hex[:12]}'
    note = sanitize_text(payload.adminNote)
    results = []

    for sid in payload.ids:
        try:
            item = db.query(UserSubmission).filter(UserSubmission.id == sid).first()
            if not item:
                results.append({'id': sid, 'ok': False, 'code': 'SUBMISSION_NOT_FOUND', 'message': '提交不存在'})
                continue

            if payload.action == 'process':
                await process_submission(db, sid)
            elif payload.action == 'approve':
                if not item.linkedAppId:
                    raise ValueError('请先处理提交并生成关联 App')
                app = db.query(App).filter(App.id == item.linkedAppId).first()
                if not app or not app.analysis:
                    raise ValueError('关联 App 分析不完整')
                app.status = 'published'
                app.isPublished = True
                app.reviewNotes = note or None
                item.status = 'approved'
                item.adminNote = note
                item.approvedAt = datetime.utcnow()
                db.commit()
            elif payload.action == 'reject':
                item.status = 'rejected'
                item.adminNote = note
                db.commit()
            elif payload.action == 'send_back':
                if not note:
                    raise ValueError('退回补充信息时备注不能为空')
                item.status = 'needs_revision'
                item.adminNote = note
                item.approvedAt = None
                db.commit()

            log_audit(
                db,
                entity_type='submission',
                entity_id=sid,
                app_id=item.linkedAppId,
                action=f'submission.bulk_{payload.action}',
                actor=admin['username'],
                before=None,
                after={'status': item.status, 'batchId': batch_id},
            )
            results.append({'id': sid, 'ok': True})
        except Exception as error:
            db.rollback()
            results.append({'id': sid, 'ok': False, 'code': 'ACTION_FAILED', 'message': str(error)})

    success = len([x for x in results if x['ok']])
    failed = len(results) - success
    job = CrawlJob(
        id=cuid_like(),
        type='submission_bulk_action',
        status='failed' if failed > 0 else 'success',
        targetType='submission',
        summary=f'action={payload.action}, success={success}, failed={failed}',
        meta={'batchId': batch_id, 'action': payload.action, 'success': success, 'failed': failed, 'ids': payload.ids},
        startedAt=datetime.utcnow(),
        finishedAt=datetime.utcnow(),
    )
    db.add(job)
    db.commit()

    return {'ok': True, 'batchId': batch_id, 'action': payload.action, 'total': len(payload.ids), 'success': success, 'failed': failed, 'results': results}


def _map_appeal_item(item: AppealTicket) -> dict:
    return {
        **model_to_dict(item),
        'createdAtLabel': to_date_label(item.createdAt),
        'updatedAtLabel': to_date_label(item.updatedAt),
        'processedAtLabel': to_date_label(item.processedAt),
    }


def _build_appeal_timeline(db: Session, item: AppealTicket) -> list[dict]:
    timeline = [
        {
            'type': 'submitted',
            'title': '申诉已提交',
            'actor': item.contactEmail,
            'at': item.createdAt.isoformat() if item.createdAt else None,
            'atLabel': to_date_label(item.createdAt),
            'description': (
                f"问题类型：{APPEAL_ISSUE_TYPE_LABELS.get(item.issueType, item.issueType)}"
                + (f"；页面：{item.pageUrl}" if item.pageUrl else '')
            ),
        }
    ]

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.entityType == 'appeal', AuditLog.entityId == item.id)
        .order_by(AuditLog.createdAt.asc(), AuditLog.id.asc())
        .all()
    )
    has_status_update = False
    for record in logs:
        after = record.after or {}
        before = record.before or {}
        action = record.action
        title = '状态更新'
        description = ''
        if action == 'appeal.updated':
            has_status_update = True
            status_after = str(after.get('status') or '')
            status_before = str(before.get('status') or '')
            if status_before and status_after and status_before != status_after:
                description = (
                    f"状态：{APPEAL_STATUS_LABELS.get(status_before, status_before)}"
                    f" -> {APPEAL_STATUS_LABELS.get(status_after, status_after)}"
                )
            elif status_after:
                description = f"状态：{APPEAL_STATUS_LABELS.get(status_after, status_after)}"

            note = sanitize_text(after.get('adminNote'), max_len=300)
            if note:
                description = (description + '；' if description else '') + f'备注：{note}'
        elif action == 'appeal.status_email_sent':
            title = '通知邮件发送成功'
            description = sanitize_text(after.get('message') or '已向开发者邮箱发送处理结果通知。', max_len=400)
        elif action == 'appeal.status_email_failed':
            title = '通知邮件发送失败'
            description = sanitize_text(after.get('message') or '邮件发送失败，请检查 SMTP 配置后重试。', max_len=400)
        elif action == 'appeal.created':
            # 已有“申诉已提交”首事件，避免重复。
            continue
        else:
            title = action
            description = sanitize_text(str(after) if after else '', max_len=400)

        timeline.append(
            {
                'type': action,
                'title': title,
                'actor': record.actor,
                'at': record.createdAt.isoformat() if record.createdAt else None,
                'atLabel': to_date_label(record.createdAt),
                'description': description,
            }
        )

    if item.processedAt and not has_status_update:
        timeline.append(
            {
                'type': 'status_inferred',
                'title': '状态已更新',
                'actor': 'system',
                'at': item.processedAt.isoformat() if item.processedAt else None,
                'atLabel': to_date_label(item.processedAt),
                'description': f"状态：{APPEAL_STATUS_LABELS.get(item.status, item.status)}",
            }
        )

    return timeline


@router.get('/appeals')
def admin_appeals(
    request: Request,
    status: str = '',
    q: str = '',
    page: int = 1,
    pageSize: int = 20,
    db: Session = Depends(get_db),
):
    require_admin(request)
    page = max(page, 1)
    pageSize = min(max(pageSize, 1), 100)

    query = db.query(AppealTicket)
    if status:
        query = query.filter(AppealTicket.status == status)
    if q:
        keyword = f'%{q.strip()}%'
        query = query.filter(
            or_(
                AppealTicket.appName.like(keyword),
                AppealTicket.description.like(keyword),
                AppealTicket.contactEmail.like(keyword),
                AppealTicket.pageUrl.like(keyword),
            )
        )

    total = query.count()
    items = query.order_by(AppealTicket.createdAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
    return {
        'page': page,
        'pageSize': pageSize,
        'total': total,
        'items': [_map_appeal_item(item) for item in items],
    }


@router.get('/appeals/{appeal_id}')
def admin_appeal_detail(appeal_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    item = db.query(AppealTicket).filter(AppealTicket.id == appeal_id).first()
    if not item:
        raise AppError(404, 'APPEAL_NOT_FOUND', '申诉记录不存在')
    site_config = get_site_settings()
    smtp_enabled = bool(site_config.get('smtpEnabled', True))
    smtp_host = sanitize_text(site_config.get('smtpHost'), max_len=200) or settings.smtp_host
    smtp_sender = sanitize_text(site_config.get('smtpSender'), max_len=200) or settings.smtp_sender
    return {
        'item': _map_appeal_item(item),
        'timeline': _build_appeal_timeline(db, item),
        'mailEnabled': bool(smtp_enabled and smtp_host and smtp_sender),
    }


class AppealPatchInput(BaseModel):
    status: Literal['pending', 'processing', 'resolved', 'rejected']
    adminNote: str | None = ''


@router.patch('/appeals/{appeal_id}')
def admin_appeal_patch(appeal_id: str, payload: AppealPatchInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    item = db.query(AppealTicket).filter(AppealTicket.id == appeal_id).first()
    if not item:
        raise AppError(404, 'APPEAL_NOT_FOUND', '申诉记录不存在')

    before = model_to_dict(item)
    item.status = payload.status
    item.adminNote = sanitize_text(payload.adminNote, max_len=2000) or None
    item.processedAt = datetime.utcnow() if payload.status in {'resolved', 'rejected'} else None
    item.updatedAt = datetime.utcnow()
    db.commit()
    db.refresh(item)

    log_audit(
        db,
        entity_type='appeal',
        entity_id=item.id,
        action='appeal.updated',
        actor=admin['username'],
        before=before,
        after=model_to_dict(item),
    )

    email_notice = {'attempted': False, 'sent': False, 'message': ''}
    status_changed_to_terminal = before.get('status') != item.status and item.status in {'resolved', 'rejected'}
    if status_changed_to_terminal and item.contactEmail:
        email_notice = send_appeal_status_email(
            to_email=item.contactEmail,
            app_name=item.appName,
            ticket_id=item.id,
            status=item.status,
            admin_note=item.adminNote,
        )
        email_action = 'appeal.status_email_sent' if email_notice.get('sent') else 'appeal.status_email_failed'
        log_audit(
            db,
            entity_type='appeal',
            entity_id=item.id,
            action=email_action,
            actor=admin['username'],
            before=None,
            after=email_notice,
        )

    return {'ok': True, 'item': _map_appeal_item(item), 'emailNotice': email_notice}


class AppCreateFromJsonInput(BaseModel):
    name: str
    slug: str | None = None
    category: str = '待分类'
    developer: str | None = None
    iconUrl: str | None = None
    privacyPolicyUrl: str | None = None
    termsOfServiceUrl: str | None = None
    rawText: str | None = None
    analysis: dict | None = None
    riskLevel: str | None = None
    oneLiner: str | None = None
    plainSummary: str | None = None
    status: Literal['draft', 'review_ready', 'published', 'archived'] = 'draft'
    isPublished: bool | None = None
    featured: bool = False
    warningPinned: bool = False
    sourceType: str = 'manual'
    versionLabel: str | None = None


@router.post('/apps/create-json')
def app_create_json(payload: AppCreateFromJsonInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)

    name = sanitize_text(payload.name, max_len=120)
    if not name:
        raise AppError(400, 'APP_NAME_REQUIRED', '请填写 App 名称')

    raw_text = sanitize_text(payload.rawText, max_len=400000)
    risk_level = sanitize_text(payload.riskLevel, max_len=20).lower() if payload.riskLevel else None
    one_liner = sanitize_text(payload.oneLiner, max_len=120) if payload.oneLiner else None
    plain_summary = sanitize_text(payload.plainSummary, max_len=1000) if payload.plainSummary else None

    if payload.analysis:
        analysis_data = _normalize_tool_analysis(payload.analysis)
    else:
        if not risk_level:
            risk_level = 'medium'
        if risk_level not in {'low', 'medium', 'high', 'critical'}:
            risk_level = 'medium'
        analysis_data = _normalize_tool_analysis(
            {
                'risk_level': risk_level,
                'one_liner': one_liner or '自动分析结果，请人工复核。',
                'key_findings': ['JSON 导入创建，请人工复核条款与结论一致性。'],
                'plain_summary': plain_summary or '暂无详细摘要，请补充后再发布。',
                'data_collected': [],
                'data_shared_with': [],
                'user_rights': [],
                'dispute': '如与官方政策冲突，请以官方条款为准。',
            }
        )

    normalized = normalize_analysis(analysis_data)
    final_status = payload.status
    final_published = payload.isPublished if payload.isPublished is not None else final_status == 'published'
    if final_published:
        final_status = 'published'

    slug_input = sanitize_text(payload.slug, max_len=120) if payload.slug else ''
    slug_base = slugify_name(slug_input or name)
    slug = _ensure_unique_slug(db, slug_base)

    now = datetime.utcnow()
    app = App(
        id=cuid_like(),
        slug=slug,
        name=name,
        category=sanitize_text(payload.category, max_len=80) or '待分类',
        developer=sanitize_text(payload.developer, max_len=120) or None,
        iconUrl=sanitize_text(payload.iconUrl, max_len=2000) or None,
        privacyPolicyUrl=sanitize_text(payload.privacyPolicyUrl, max_len=2000) or None,
        termsOfServiceUrl=sanitize_text(payload.termsOfServiceUrl, max_len=2000) or None,
        rawText=raw_text or None,
        analysis=analysis_data,
        analysisSource=analysis_data,
        riskLevel=normalized['riskLevel'],
        oneLiner=normalized['oneLiner'],
        plainSummary=normalized['plainSummary'],
        status=final_status,
        isPublished=bool(final_published),
        featured=payload.featured,
        warningPinned=payload.warningPinned,
        sourceType=sanitize_text(payload.sourceType, max_len=40) or 'manual',
        contentHash=hash_text(raw_text) if raw_text else None,
        analyzedAt=now,
        updatedAt=now,
        createdAt=now,
    )

    try:
        db.add(app)
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(409, 'APP_ALREADY_EXISTS', '同名应用或 slug 已存在，请调整后重试')

    if raw_text:
        db.add(
            PolicyVersion(
                id=cuid_like(),
                appId=app.id,
                versionLabel=sanitize_text(payload.versionLabel, max_len=120) or f"JSON Import {now.strftime('%Y-%m-%d')}",
                rawText=raw_text,
                contentHash=app.contentHash or hash_text(raw_text),
                analysis=analysis_data,
                sourceUrl=app.privacyPolicyUrl,
                createdAt=now,
            )
        )

    db.commit()
    db.refresh(app)

    log_audit(
        db,
        entity_type='app',
        entity_id=app.id,
        app_id=app.id,
        action='app.created_from_json',
        actor=admin['username'],
        before=None,
        after={'name': app.name, 'slug': app.slug, 'status': app.status},
    )

    return {'ok': True, 'app': model_to_dict(app)}


@router.get('/apps')
def admin_apps(
    request: Request,
    q: str = '',
    status: str = '',
    statuses: str = '',
    risk: str = '',
    page: int = 1,
    pageSize: int = 20,
    db: Session = Depends(get_db),
):
    require_admin(request)
    page = max(page, 1)
    pageSize = min(max(pageSize, 1), 100)

    query = db.query(App)
    if q:
        keyword = f'%{q.strip()}%'
        query = query.filter(or_(App.name.like(keyword), App.developer.like(keyword), App.slug.like(keyword)))
    status_values = []
    status_source = statuses or status
    for item in str(status_source or '').split(','):
        value = item.strip()
        if value:
            status_values.append(value)
    if status_values:
        query = query.filter(App.status.in_(status_values))
    if risk:
        query = query.filter(App.riskLevel == risk)

    total = query.count()
    items = query.order_by(App.updatedAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()

    total_apps = db.query(App).filter(App.isPublished.is_(True)).count()
    pending_submissions = db.query(UserSubmission).filter(UserSubmission.status.in_(['pending', 'processing', 'review_ready'])).count()
    high_risk_apps = db.query(App).filter(App.riskLevel.in_(['high', 'critical'])).count()

    return {
        'summary': {'totalApps': total_apps, 'pendingSubmissions': pending_submissions, 'highRiskApps': high_risk_apps},
        'page': page,
        'pageSize': pageSize,
        'total': total,
        'items': [
            {
                **model_to_dict(app),
                'riskLevel': app.riskLevel or normalize_analysis(app.analysis)['riskLevel'],
                'updatedAtLabel': to_date_label(app.updatedAt),
                'analyzedAtLabel': to_date_label(app.analyzedAt),
            }
            for app in items
        ],
    }


@router.get('/apps/{app_id}')
def app_detail_admin(app_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')

    versions = db.query(PolicyVersion).filter(PolicyVersion.appId == app_id).order_by(PolicyVersion.createdAt.desc()).limit(10).all()
    logs = db.query(AuditLog).filter(AuditLog.appId == app_id).order_by(AuditLog.createdAt.desc()).limit(20).all()

    return {
        'app': {
            **model_to_dict(app),
            'normalizedAnalysis': normalize_analysis(app.analysis),
            'versions': [{**model_to_dict(v), 'createdAtLabel': to_date_label(v.createdAt)} for v in versions],
            'logs': [{**model_to_dict(l), 'createdAtLabel': to_date_label(l.createdAt)} for l in logs],
        }
    }


class AppPatchInput(BaseModel):
    name: str
    slug: str
    category: str
    developer: str | None = None
    iconUrl: str | None = None
    privacyPolicyUrl: str | None = None
    termsOfServiceUrl: str | None = None
    riskLevel: str
    oneLiner: str
    plainSummary: str
    reviewNotes: str | None = ''
    featured: bool = False
    warningPinned: bool = False
    status: str = 'draft'
    isPublished: bool = False


@router.patch('/apps/{app_id}')
def app_patch(app_id: str, payload: AppPatchInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')

    before = model_to_dict(app).copy()
    app.name = payload.name
    app.slug = payload.slug
    app.category = payload.category
    app.developer = payload.developer
    app.iconUrl = payload.iconUrl
    app.privacyPolicyUrl = payload.privacyPolicyUrl
    app.termsOfServiceUrl = payload.termsOfServiceUrl
    app.riskLevel = payload.riskLevel
    app.oneLiner = payload.oneLiner
    app.plainSummary = payload.plainSummary
    app.reviewNotes = sanitize_text(payload.reviewNotes)
    app.featured = payload.featured
    app.warningPinned = payload.warningPinned
    app.status = payload.status
    app.isPublished = True if payload.status == 'published' else payload.isPublished
    db.commit()
    db.refresh(app)

    log_audit(db, entity_type='app', entity_id=app_id, app_id=app_id, action='app.updated', actor=admin['username'], before=before, after=model_to_dict(app))
    return {'ok': True, 'app': model_to_dict(app)}


@router.post('/apps/{app_id}/publish')
def app_publish(app_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')
    before = {'status': app.status, 'isPublished': app.isPublished}
    app.status = 'published'
    app.isPublished = True
    db.commit()
    log_audit(db, entity_type='app', entity_id=app_id, app_id=app_id, action='app.published', actor=admin['username'], before=before, after={'status': app.status, 'isPublished': app.isPublished})
    return {'ok': True}


@router.post('/apps/{app_id}/reanalyze')
async def app_reanalyze(app_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')
    if not app.rawText:
        raise AppError(400, 'RAW_TEXT_MISSING', '缺少可分析的隐私政策文本')

    analysis = await analyze_policy_text(app.rawText)
    app.analysis = analysis
    app.riskLevel = analysis.get('risk_level')
    app.oneLiner = analysis.get('one_liner')
    app.plainSummary = analysis.get('plain_summary')
    app.analyzedAt = datetime.utcnow()
    if app.status == 'draft':
        app.status = 'review_ready'
    app.lastError = None

    version = PolicyVersion(
        id=cuid_like(),
        appId=app_id,
        versionLabel=f"Reanalyzed {datetime.utcnow().strftime('%Y-%m-%d')}",
        rawText=app.rawText,
        contentHash=app.contentHash or 'manual',
        analysis=analysis,
        sourceUrl=app.privacyPolicyUrl,
    )
    db.add(version)
    db.commit()

    log_audit(db, entity_type='app', entity_id=app_id, app_id=app_id, action='app.reanalyzed', actor=admin['username'], before=None, after=analysis)
    return {'ok': True, 'analysis': analysis}


@router.delete('/apps/{app_id}')
def app_delete(app_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')

    before = {
        'id': app.id,
        'name': app.name,
        'slug': app.slug,
        'status': app.status,
    }
    _delete_app_with_dependencies(db, app_id)
    db.commit()

    log_audit(
        db,
        entity_type='app',
        entity_id=app_id,
        action='app.deleted',
        actor=admin['username'],
        before=before,
        after={'deleted': True},
    )
    return {'ok': True}

class SiteSettingsUpdateInput(BaseModel):
    showAppIcon: bool | None = None
    iconUsageNotice: str | None = None
    legalDisclaimerShort: str | None = None
    disclaimerNoAdviceNotice: str | None = None
    disclaimerAccuracyNotice: str | None = None
    disclaimerTrademarkNotice: str | None = None
    disclaimerRightsContactNotice: str | None = None
    dataSourceNotice: str | None = None
    aiAnalysisNotice: str | None = None
    contactEmail: str | None = None
    appealSlaDays: int | None = None
    smtpEnabled: bool | None = None
    smtpHost: str | None = None
    smtpPort: int | None = None
    smtpUsername: str | None = None
    smtpPassword: str | None = None
    smtpSender: str | None = None
    smtpUseTls: bool | None = None
    smtpUseSsl: bool | None = None
    mailSubjectTemplate: str | None = None
    mailSignature: str | None = None
    mailCcEnabled: bool | None = None


@router.get('/site-settings')
def admin_get_site_settings(request: Request):
    require_admin(request)
    return {'ok': True, 'settings': get_site_settings()}


@router.patch('/site-settings')
def admin_update_site_settings(payload: SiteSettingsUpdateInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    before = get_site_settings()
    after = update_site_settings(payload.model_dump())
    log_audit(
        db,
        entity_type='site_setting',
        entity_id='global',
        action='site_setting.updated',
        actor=admin['username'],
        before=before,
        after=after,
    )
    return {'ok': True, 'settings': after}


class AppBulkInput(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    action: Literal['publish', 'archive', 'reanalyze', 'delete']


@router.post('/apps/bulk-action')
async def app_bulk(payload: AppBulkInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    batch_id = f'app-{uuid.uuid4().hex[:12]}'
    results = []

    for app_id in payload.ids:
        try:
            app = db.query(App).filter(App.id == app_id).first()
            if not app:
                results.append({'id': app_id, 'ok': False, 'code': 'APP_NOT_FOUND', 'message': '应用不存在'})
                continue

            if payload.action == 'publish':
                app.status = 'published'
                app.isPublished = True
            elif payload.action == 'archive':
                app.status = 'archived'
                app.isPublished = False
            elif payload.action == 'delete':
                before = {
                    'id': app.id,
                    'name': app.name,
                    'slug': app.slug,
                    'status': app.status,
                }
                _delete_app_with_dependencies(db, app_id)
                db.commit()
                log_audit(
                    db,
                    entity_type='app',
                    entity_id=app_id,
                    action='app.bulk_delete',
                    actor=admin['username'],
                    before=before,
                    after={'batchId': batch_id, 'deleted': True},
                )
                results.append({'id': app_id, 'ok': True})
                continue
            else:
                if not app.rawText:
                    raise ValueError('当前 App 没有可分析文本')
                analysis = await analyze_policy_text(app.rawText)
                app.analysis = analysis
                app.riskLevel = analysis.get('risk_level')
                app.oneLiner = analysis.get('one_liner')
                app.plainSummary = analysis.get('plain_summary')
                app.analyzedAt = datetime.utcnow()
                if app.status == 'draft':
                    app.status = 'review_ready'
                app.lastError = None

            db.commit()
            log_audit(db, entity_type='app', entity_id=app_id, app_id=app_id, action=f'app.bulk_{payload.action}', actor=admin['username'], before=None, after={'batchId': batch_id})
            results.append({'id': app_id, 'ok': True})
        except Exception as error:
            db.rollback()
            results.append({'id': app_id, 'ok': False, 'code': 'ACTION_FAILED', 'message': str(error)})

    success = len([x for x in results if x['ok']])
    failed = len(results) - success
    db.add(
        CrawlJob(
            id=cuid_like(),
            type='app_bulk_action',
            status='failed' if failed > 0 else 'success',
            targetType='app',
            summary=f'action={payload.action}, success={success}, failed={failed}',
            meta={'batchId': batch_id, 'action': payload.action, 'success': success, 'failed': failed, 'ids': payload.ids},
            startedAt=datetime.utcnow(),
            finishedAt=datetime.utcnow(),
        )
    )
    db.commit()

    return {'ok': True, 'batchId': batch_id, 'action': payload.action, 'total': len(payload.ids), 'success': success, 'failed': failed, 'results': results}


@router.get('/analyses')
def analyses_list(request: Request, q: str = '', page: int = 1, pageSize: int = 20, db: Session = Depends(get_db)):
    require_admin(request)
    page = max(page, 1)
    pageSize = min(max(pageSize, 1), 100)

    query = db.query(App)
    if q:
        keyword = f'%{q.strip()}%'
        query = query.filter(or_(App.name.like(keyword), App.slug.like(keyword), App.category.like(keyword)))

    total = query.count()
    items = query.order_by(App.analyzedAt.desc()).offset((page - 1) * pageSize).limit(pageSize).all()
    return {
        'page': page,
        'pageSize': pageSize,
        'total': total,
        'items': [
            {
                'id': app.id,
                'name': app.name,
                'riskLevel': app.riskLevel,
                'status': app.status,
                'analyzedAtLabel': to_date_label(app.analyzedAt),
                'oneLiner': app.oneLiner,
            }
            for app in items
        ],
    }


@router.get('/analyses/{app_id}')
def analysis_detail(app_id: str, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')
    return {'app': model_to_dict(app)}


class AnalysisEditInput(BaseModel):
    risk_level: str
    one_liner: str
    key_findings: list[str]
    plain_summary: str
    data_collected: list[str]
    data_shared_with: list[str]
    user_rights: list[str]
    dispute: str


@router.patch('/analyses/{app_id}')
def analysis_edit(app_id: str, payload: AnalysisEditInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app:
        raise AppError(404, 'APP_NOT_FOUND', '应用不存在')

    legal_fields = [payload.one_liner, payload.plain_summary, payload.dispute, *payload.key_findings]
    if any(contains_deterministic_legal_terms(item) for item in legal_fields):
        raise AppError(400, 'LEGAL_TONE_VIOLATION', '请避免使用“违法/非法”等确定性法律判断，请改为中性表述')

    body = payload.model_dump()
    app.analysis = body
    app.riskLevel = payload.risk_level
    app.oneLiner = payload.one_liner
    app.plainSummary = payload.plain_summary
    app.analyzedAt = datetime.utcnow()
    if app.status == 'draft':
        app.status = 'review_ready'
    db.commit()

    log_audit(db, entity_type='analysis', entity_id=app_id, app_id=app_id, action='analysis.edited', actor=admin['username'], before=None, after=body)
    return {'ok': True, 'app': model_to_dict(app)}


@router.post('/analyses/{app_id}/restore')
def analysis_restore(app_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    app = db.query(App).filter(App.id == app_id).first()
    if not app or not app.analysisSource:
        raise AppError(404, 'ANALYSIS_SOURCE_NOT_FOUND', '未找到 AI 初稿，无法恢复')

    app.analysis = app.analysisSource
    app.riskLevel = app.analysisSource.get('risk_level')
    app.oneLiner = app.analysisSource.get('one_liner')
    app.plainSummary = app.analysisSource.get('plain_summary')
    app.analyzedAt = datetime.utcnow()
    db.commit()

    log_audit(db, entity_type='analysis', entity_id=app_id, app_id=app_id, action='analysis.restored', actor=admin['username'], before=None, after=app.analysisSource)
    return {'ok': True, 'app': model_to_dict(app)}


class AnalysisBulkInput(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=200)
    action: Literal['restore_ai', 'recalculate_risk']


@router.post('/analyses/bulk-action')
async def analysis_bulk(payload: AnalysisBulkInput, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    batch_id = f'analysis-{uuid.uuid4().hex[:12]}'
    results = []

    for app_id in payload.ids:
        try:
            app = db.query(App).filter(App.id == app_id).first()
            if not app:
                results.append({'id': app_id, 'ok': False, 'code': 'APP_NOT_FOUND', 'message': '应用不存在'})
                continue

            if payload.action == 'restore_ai':
                if not app.analysisSource:
                    raise ValueError('找不到 AI 初稿')
                app.analysis = app.analysisSource
                app.riskLevel = app.analysisSource.get('risk_level')
                app.oneLiner = app.analysisSource.get('one_liner')
                app.plainSummary = app.analysisSource.get('plain_summary')
                app.analyzedAt = datetime.utcnow()
            else:
                if not app.rawText:
                    raise ValueError('当前 App 没有可分析文本')
                analysis = await analyze_policy_text(app.rawText)
                app.analysis = analysis
                app.riskLevel = analysis.get('risk_level')
                app.oneLiner = analysis.get('one_liner')
                app.plainSummary = analysis.get('plain_summary')
                app.analyzedAt = datetime.utcnow()

            db.commit()
            log_audit(db, entity_type='analysis', entity_id=app_id, app_id=app_id, action=f'analysis.bulk_{payload.action}', actor=admin['username'], before=None, after={'batchId': batch_id})
            results.append({'id': app_id, 'ok': True})
        except Exception as error:
            db.rollback()
            results.append({'id': app_id, 'ok': False, 'code': 'ACTION_FAILED', 'message': str(error)})

    success = len([x for x in results if x['ok']])
    failed = len(results) - success
    db.add(
        CrawlJob(
            id=cuid_like(),
            type='analysis_bulk_action',
            status='failed' if failed > 0 else 'success',
            targetType='analysis',
            summary=f'action={payload.action}, success={success}, failed={failed}',
            meta={'batchId': batch_id, 'action': payload.action, 'success': success, 'failed': failed, 'ids': payload.ids},
            startedAt=datetime.utcnow(),
            finishedAt=datetime.utcnow(),
        )
    )
    db.commit()

    return {'ok': True, 'batchId': batch_id, 'action': payload.action, 'total': len(payload.ids), 'success': success, 'failed': failed, 'results': results}


@router.get('/jobs')
def jobs(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    items = db.query(CrawlJob).order_by(CrawlJob.startedAt.desc()).limit(100).all()
    return {
        'items': [
            {
                **model_to_dict(j),
                'startedAtLabel': to_date_label(j.startedAt),
                'finishedAtLabel': to_date_label(j.finishedAt),
                'retryable': j.status == 'failed',
            }
            for j in items
        ]
    }


class RunJobInput(BaseModel):
    type: Literal['process_pending_submissions', 'reanalyze_app']
    targetId: str | None = None


@router.post('/jobs/run')
async def jobs_run(payload: RunJobInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    job = create_job(db, payload.type, 'app' if payload.targetId else None, payload.targetId)

    if payload.type == 'process_pending_submissions':
        async def _work():
            pending = (
                db.query(UserSubmission)
                .filter(UserSubmission.status == 'pending')
                .order_by(UserSubmission.createdAt.asc())
                .limit(10)
                .all()
            )
            processed = []
            for item in pending:
                try:
                    await process_submission(db, item.id)
                    processed.append(item.appName)
                except Exception as error:
                    item.status = 'failed'
                    item.processingError = str(error)
                    db.commit()
            return processed

        result = await run_job(db, job.id, _work, '批量处理待审核提交')
        return {'ok': True, 'result': result}

    if not payload.targetId:
        raise AppError(400, 'TARGET_ID_REQUIRED', '缺少 targetId 参数')

    async def _reanalyze():
        app = db.query(App).filter(App.id == payload.targetId).first()
        if not app or not app.rawText:
            raise ValueError('目标 App 缺少可分析文本')
        analysis = await analyze_policy_text(app.rawText)
        app.analysis = analysis
        app.riskLevel = analysis.get('risk_level')
        app.oneLiner = analysis.get('one_liner')
        app.plainSummary = analysis.get('plain_summary')
        app.analyzedAt = datetime.utcnow()
        db.commit()
        return analysis

    result = await run_job(db, job.id, _reanalyze, '重新分析 App')
    return {'ok': True, 'result': result}


@router.post('/jobs/{job_id}/retry')
async def retry_job(job_id: str, request: Request, db: Session = Depends(get_db)):
    admin = require_admin(request)
    source_job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not source_job:
        raise AppError(404, 'JOB_NOT_FOUND', '任务不存在')
    if source_job.status != 'failed':
        raise AppError(400, 'JOB_NOT_RETRYABLE', '仅失败任务可重试')

    retry_job_row = create_job(
        db,
        f'{source_job.type}_retry',
        source_job.targetType,
        source_job.targetId,
        {'retryOf': source_job.id, 'originalType': source_job.type},
    )

    if source_job.type == 'submission_process' and source_job.targetId:
        await run_job(db, retry_job_row.id, lambda: process_submission(db, source_job.targetId), '重试处理单条提交')
    elif source_job.type == 'process_pending_submissions':
        async def _work():
            pending = db.query(UserSubmission).filter(UserSubmission.status == 'pending').order_by(UserSubmission.createdAt.asc()).limit(10).all()
            for item in pending:
                try:
                    await process_submission(db, item.id)
                except Exception as error:
                    item.status = 'failed'
                    item.processingError = str(error)
                    db.commit()

        await run_job(db, retry_job_row.id, _work, '重试批量处理待审核提交')
    else:
        raise AppError(400, 'UNSUPPORTED_RETRY_TYPE', f'该任务类型暂不支持重试: {source_job.type}')

    log_audit(
        db,
        entity_type='job',
        entity_id=retry_job_row.id,
        action='job.retried',
        actor=admin['username'],
        before=model_to_dict(source_job),
        after=model_to_dict(retry_job_row),
    )

    return {'ok': True, 'retryJobId': retry_job_row.id}



