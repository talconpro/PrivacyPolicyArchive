from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from app.models import CrawlJob


def cuid_like() -> str:
    return uuid.uuid4().hex[:24]


def create_job(db: Session, job_type: str, target_type: str | None = None, target_id: str | None = None, meta=None):
    job = CrawlJob(
        id=cuid_like(),
        type=job_type,
        status='queued',
        targetType=target_type,
        targetId=target_id,
        meta=meta,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


async def run_job(db: Session, job_id: str, work, summary: str | None = None):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    job.status = 'running'
    job.startedAt = datetime.utcnow()
    db.commit()

    try:
        result = await work()
        job.status = 'success'
        job.finishedAt = datetime.utcnow()
        job.summary = summary
        db.commit()
        return result
    except Exception as error:
        job.status = 'failed'
        job.finishedAt = datetime.utcnow()
        job.summary = str(error)
        job.log = repr(error)
        db.commit()
        raise
