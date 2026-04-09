from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models import App, PolicyVersion, UserSubmission
from app.services.analysis import analyze_policy_text
from app.services.policy_fetcher import fetch_policy_text
from app.services.sanitize import slugify_name


def cuid_like() -> str:
    return uuid.uuid4().hex[:24]


async def process_submission(db: Session, submission_id: str):
    submission = db.query(UserSubmission).filter(UserSubmission.id == submission_id).first()
    if not submission:
        raise AppError(404, 'SUBMISSION_NOT_FOUND', '提交记录不存在')

    submission.status = 'processing'
    submission.fetchStatus = 'running'
    submission.analysisStatus = 'queued'
    submission.processingError = None
    db.commit()

    try:
        fetched = await fetch_policy_text(submission.privacyUrl)
        analysis = await analyze_policy_text(fetched['text'])

        slug_base = slugify_name(submission.appName)
        slug = slug_base
        i = 2

        while True:
            conflict = db.query(App).filter(App.slug == slug).first()
            if not conflict or (submission.linkedAppId and conflict.id == submission.linkedAppId):
                break
            slug = f'{slug_base}-{i}'
            i += 1

        existing = None
        if submission.linkedAppId:
            existing = db.query(App).filter(App.id == submission.linkedAppId).first()
        if not existing:
            existing = db.query(App).filter((App.name == submission.appName) | (App.slug == slug)).first()

        now = datetime.utcnow()
        if existing:
            app = existing
            app.name = submission.appName
            app.slug = slug
            app.privacyPolicyUrl = submission.privacyUrl
            app.termsOfServiceUrl = submission.termsUrl
            app.rawText = fetched['text']
            app.contentHash = fetched['contentHash']
            app.analysis = analysis
            app.analysisSource = analysis
            app.riskLevel = analysis.get('risk_level')
            app.oneLiner = analysis.get('one_liner')
            app.plainSummary = analysis.get('plain_summary')
            app.analyzedAt = now
            app.lastFetchAt = now
            app.sourceType = 'submission'
            app.sourceSubmissionId = submission.id
            app.status = 'review_ready'
            app.isPublished = False
            app.lastError = None
        else:
            app = App(
                id=cuid_like(),
                name=submission.appName,
                slug=slug,
                category='Uncategorized',
                privacyPolicyUrl=submission.privacyUrl,
                termsOfServiceUrl=submission.termsUrl,
                rawText=fetched['text'],
                contentHash=fetched['contentHash'],
                analysis=analysis,
                analysisSource=analysis,
                riskLevel=analysis.get('risk_level'),
                oneLiner=analysis.get('one_liner'),
                plainSummary=analysis.get('plain_summary'),
                analyzedAt=now,
                lastFetchAt=now,
                sourceType='submission',
                sourceSubmissionId=submission.id,
                status='review_ready',
                isPublished=False,
                featured=False,
                warningPinned=False,
            )
            db.add(app)

        db.flush()

        version = PolicyVersion(
            id=cuid_like(),
            appId=app.id,
            versionLabel=f"Auto {datetime.utcnow().strftime('%Y-%m-%d')}",
            rawText=fetched['text'],
            contentHash=fetched['contentHash'],
            analysis=analysis,
            sourceUrl=submission.privacyUrl,
        )
        db.add(version)

        submission.status = 'review_ready'
        submission.fetchStatus = 'success'
        submission.analysisStatus = 'success'
        submission.extractedText = fetched['text'][:20000]
        submission.extractedHash = fetched['contentHash']
        submission.suggestedRisk = analysis.get('risk_level')
        submission.analysisDraft = analysis
        submission.linkedAppId = app.id
        db.commit()
        db.refresh(app)
        return app
    except AppError as error:
        submission.status = 'failed'
        submission.fetchStatus = 'failed'
        submission.analysisStatus = 'failed'
        submission.processingError = error.message
        db.commit()
        raise
    except Exception as error:
        submission.status = 'failed'
        submission.fetchStatus = 'failed'
        submission.analysisStatus = 'failed'
        submission.processingError = str(error)
        db.commit()
        raise AppError(400, 'SUBMISSION_PROCESS_FAILED', f'处理失败: {error}')
