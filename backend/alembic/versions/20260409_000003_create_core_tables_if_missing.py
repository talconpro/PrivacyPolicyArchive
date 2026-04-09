"""create_core_tables_if_missing

Revision ID: 20260409_000003
Revises: 20260409_000002
Create Date: 2026-04-09 22:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.db.session import Base
from app.models import App, PolicyVersion, UserSubmission, CrawlJob, AuditLog, AppealTicket


revision: str = "20260409_000003"
down_revision: Union[str, None] = "20260409_000002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CORE_TABLES = [
    "App",
    "PolicyVersion",
    "UserSubmission",
    "CrawlJob",
    "AuditLog",
    "AppealTicket",
]


def upgrade() -> None:
    bind = op.get_bind()
    for table_name in CORE_TABLES:
        table = Base.metadata.tables.get(table_name)
        if table is None:
            continue
        table.create(bind=bind, checkfirst=True)

    appeal_table = Base.metadata.tables.get("AppealTicket")
    if appeal_table is not None:
        sa.Index("ix_AppealTicket_status", appeal_table.c.status).create(bind=bind, checkfirst=True)
        sa.Index("ix_AppealTicket_createdAt", appeal_table.c.createdAt).create(bind=bind, checkfirst=True)


def downgrade() -> None:
    # Safety-first: do not drop core tables automatically in downgrade.
    pass
