from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, HttpUrl
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.session import get_db
from app.models import App, PolicyVersion, UserSubmission, AppealTicket
from app.services.audit import log_audit
from app.services.formatters import normalize_analysis, to_date_label
from app.services.jobs import create_job
from app.services.sanitize import sanitize_text
from app.services.security import hash_ip, verify_captcha
from app.services.site_settings import get_public_site_settings

router = APIRouter(tags=['public'])


def cuid_like() -> str:
    return uuid.uuid4().hex[:24]


def map_search_app(app: App):
    analysis = normalize_analysis(app.analysis)
    return {
        'id': app.id,
        'slug': app.slug,
        'name': app.name,
        'category': app.category,
        'developer': app.developer,
        'iconUrl': app.iconUrl,
        'riskLevel': app.riskLevel or analysis['riskLevel'],
        'oneLiner': app.oneLiner or analysis['oneLiner'],
        'plainSummary': app.plainSummary or analysis['plainSummary'],
        'updatedAt': app.updatedAt,
        'updatedAtLabel': to_date_label(app.updatedAt),
    }


@router.get('/home')
def home(db: Session = Depends(get_db)):
    where = App.isPublished.is_(True)
    hot_apps = db.query(App).filter(where).order_by(App.featured.desc(), App.updatedAt.desc()).limit(6).all()
    latest_apps = db.query(App).filter(where).order_by(App.updatedAt.desc()).limit(5).all()
    critical_apps = (
        db.query(App)
        .filter(App.isPublished.is_(True))
        .filter(or_(App.warningPinned.is_(True), App.riskLevel.in_(['high', 'critical'])))
        .order_by(App.analyzedAt.desc())
        .limit(5)
        .all()
    )

    def map_app(app: App):
        analysis = normalize_analysis(app.analysis)
        return {
            'id': app.id,
            'slug': app.slug,
            'name': app.name,
            'category': app.category,
            'developer': app.developer,
            'iconUrl': app.iconUrl,
            'riskLevel': app.riskLevel or analysis['riskLevel'],
            'oneLiner': app.oneLiner or analysis['oneLiner'],
            'plainSummary': app.plainSummary or analysis['plainSummary'],
            'updatedAt': app.updatedAt,
            'updatedAtLabel': to_date_label(app.updatedAt),
        }

    return {
        'hotApps': [map_app(a) for a in hot_apps],
        'latestApps': [map_app(a) for a in latest_apps],
        'criticalApps': [map_app(a) for a in critical_apps],
    }


@router.get('/site-settings')
def site_settings():
    return {'ok': True, 'settings': get_public_site_settings()}


@router.get('/categories')
def categories(db: Session = Depends(get_db)):
    rows = (
        db.query(App.category, func.count(App.id).label('count'))
        .filter(App.isPublished.is_(True))
        .group_by(App.category)
        .order_by(func.count(App.id).desc())
        .all()
    )
    return {'items': [{'category': row[0], 'count': row[1]} for row in rows]}


@router.get('/search')
def search(q: str = '', category: str = '', risk: str = '', db: Session = Depends(get_db)):
    query = db.query(App).filter(App.isPublished.is_(True))
    if q.strip():
        keyword = f"%{q.strip()}%"
        query = query.filter(or_(App.name.like(keyword), App.developer.like(keyword), App.slug.like(keyword)))
    if category.strip():
        query = query.filter(App.category == category.strip())
    if risk.strip():
        query = query.filter(App.riskLevel == risk.strip())

    items = query.order_by(App.updatedAt.desc()).limit(20 if q.strip() else 50).all()

    categories = db.query(App.category).filter(App.isPublished.is_(True)).distinct().order_by(App.category.asc()).all()
    return {'categories': [item[0] for item in categories], 'items': [map_search_app(app) for app in items]}


class CompareInput(BaseModel):
    slugs: list[str]


@router.post('/compare')
def compare(payload: CompareInput, db: Session = Depends(get_db)):
    if len(payload.slugs) < 2 or len(payload.slugs) > 4:
        raise AppError(400, 'INVALID_SLUGS', '请传入 2-4 个应用 slug')

    apps = db.query(App).filter(App.slug.in_(payload.slugs), App.isPublished.is_(True)).all()
    return {
        'items': [
            {
                'id': a.id,
                'slug': a.slug,
                'name': a.name,
                'category': a.category,
                'riskLevel': a.riskLevel,
                **normalize_analysis(a.analysis),
            }
            for a in apps
        ]
    }


@router.get('/apps/{slug}')
def app_detail(slug: str, db: Session = Depends(get_db)):
    app = db.query(App).filter(App.slug == slug).first()
    if not app or not app.isPublished:
        raise AppError(404, 'APP_NOT_FOUND', 'App not found')

    analysis = normalize_analysis(app.analysis)
    similar = (
        db.query(App.name, App.slug)
        .filter(App.category == app.category, App.id != app.id, App.isPublished.is_(True))
        .limit(4)
        .all()
    )

    app_versions = (
        db.query(PolicyVersion)
        .filter(PolicyVersion.appId == app.id)
        .order_by(PolicyVersion.createdAt.desc())
        .limit(6)
        .all()
    )

    return {
        'id': app.id,
        'slug': app.slug,
        'name': app.name,
        'category': app.category,
        'developer': app.developer,
        'iconUrl': app.iconUrl,
        'privacyPolicyUrl': app.privacyPolicyUrl,
        'termsOfServiceUrl': app.termsOfServiceUrl,
        'analyzedAtLabel': to_date_label(app.analyzedAt),
        'updatedAtLabel': to_date_label(app.updatedAt),
        'similarApps': [{'name': s[0], 'slug': s[1]} for s in similar],
        'versions': [{'id': v.id, 'versionLabel': v.versionLabel, 'createdAtLabel': to_date_label(v.createdAt)} for v in app_versions],
        **analysis,
        'riskLevel': app.riskLevel or analysis['riskLevel'],
        'oneLiner': app.oneLiner or analysis['oneLiner'],
        'plainSummary': app.plainSummary or analysis['plainSummary'],
    }


class SubmissionInput(BaseModel):
    appName: str
    privacyUrl: HttpUrl
    termsUrl: HttpUrl | None = None
    remark: str | None = None
    submitterEmail: str | None = None
    captchaToken: str | None = None


class AppealInput(BaseModel):
    appName: str
    pageUrl: HttpUrl | None = None
    issueType: str
    description: str
    evidenceUrls: list[HttpUrl] | None = None
    contactEmail: str
    captchaToken: str | None = None


@router.post('/submissions')
async def create_submission(payload: SubmissionInput, request: Request, db: Session = Depends(get_db)):
    await verify_captcha(payload.captchaToken)

    ip = request.client.host if request.client else '0.0.0.0'
    ip_hash = hash_ip(ip)

    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = db.query(UserSubmission).filter(UserSubmission.ipHash == ip_hash, UserSubmission.createdAt >= today_start).count()
    if today_count >= 5:
        raise AppError(429, 'RATE_LIMITED', '提交过于频繁，请稍后再试')

    duplicated = (
        db.query(UserSubmission)
        .filter(
            UserSubmission.appName == payload.appName,
            UserSubmission.privacyUrl == str(payload.privacyUrl),
            UserSubmission.status.in_(['pending', 'processing', 'review_ready']),
        )
        .first()
    )
    if duplicated:
        raise AppError(409, 'DUPLICATED_SUBMISSION', '相同提交正在处理中，请勿重复提交')

    db.query(UserSubmission).filter(
        UserSubmission.appName == payload.appName,
        UserSubmission.privacyUrl == str(payload.privacyUrl),
        UserSubmission.status == 'needs_revision',
    ).update({'status': 'superseded'})

    item = UserSubmission(
        id=cuid_like(),
        appName=payload.appName,
        privacyUrl=str(payload.privacyUrl),
        termsUrl=str(payload.termsUrl) if payload.termsUrl else None,
        remark=sanitize_text(payload.remark),
        submitterEmail=str(payload.submitterEmail) if payload.submitterEmail else None,
        ipHash=ip_hash,
        status='pending',
        fetchStatus='idle',
        analysisStatus='idle',
    )
    db.add(item)
    db.commit()
    db.refresh(item)

    create_job(db, 'submission_ingest', 'submission', item.id, {'appName': payload.appName})
    return {'ok': True, 'id': item.id}


@router.post('/appeals')
async def create_appeal(payload: AppealInput, request: Request, db: Session = Depends(get_db)):
    await verify_captcha(payload.captchaToken)

    app_name = sanitize_text(payload.appName, max_len=120)
    issue_type = sanitize_text(payload.issueType, max_len=40).lower()
    description = sanitize_text(payload.description, max_len=4000)
    contact_email = sanitize_text(payload.contactEmail, max_len=120).lower()
    page_url = str(payload.pageUrl) if payload.pageUrl else None

    allowed_issue_types = {'inaccurate_info', 'infringement', 'outdated_content', 'other'}
    if issue_type not in allowed_issue_types:
        raise AppError(400, 'INVALID_ISSUE_TYPE', 'issueType 不合法')
    if not app_name:
        raise AppError(400, 'APP_NAME_REQUIRED', '请填写应用名称')
    if not description:
        raise AppError(400, 'DESCRIPTION_REQUIRED', '请填写申诉说明')
    if '@' not in contact_email:
        raise AppError(400, 'CONTACT_EMAIL_REQUIRED', '请填写有效联系邮箱')

    ip = request.client.host if request.client else '0.0.0.0'
    ip_hash = hash_ip(ip)
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = (
        db.query(AppealTicket)
        .filter(AppealTicket.ipHash == ip_hash, AppealTicket.createdAt >= today_start)
        .count()
    )
    if today_count >= 10:
        raise AppError(429, 'RATE_LIMITED', '提交过于频繁，请稍后再试')

    evidence_urls = [str(url) for url in (payload.evidenceUrls or [])][:20]
    now = datetime.utcnow()
    ticket = AppealTicket(
        id=cuid_like(),
        appName=app_name,
        pageUrl=page_url,
        issueType=issue_type,
        description=description,
        evidenceUrls=evidence_urls,
        contactEmail=contact_email,
        ipHash=ip_hash,
        status='pending',
        createdAt=now,
        updatedAt=now,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    log_audit(
        db,
        entity_type='appeal',
        entity_id=ticket.id,
        action='appeal.created',
        actor='public',
        before=None,
        after={
            'status': ticket.status,
            'issueType': ticket.issueType,
            'contactEmail': ticket.contactEmail,
        },
    )
    return {'ok': True, 'id': ticket.id}
