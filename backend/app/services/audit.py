import uuid
from sqlalchemy.orm import Session

from app.models import AuditLog


def cuid_like() -> str:
    return uuid.uuid4().hex[:24]


def log_audit(
    db: Session,
    *,
    entity_type: str,
    entity_id: str,
    action: str,
    actor: str,
    app_id: str | None = None,
    before=None,
    after=None,
):
    record = AuditLog(
        id=cuid_like(),
        appId=app_id,
        entityType=entity_type,
        entityId=entity_id,
        action=action,
        actor=actor,
        before=before,
        after=after,
    )
    db.add(record)
    db.commit()
