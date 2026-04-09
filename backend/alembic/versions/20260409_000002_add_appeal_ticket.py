"""add_appeal_ticket

Revision ID: 20260409_000002
Revises: 20260408_000001
Create Date: 2026-04-09 17:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260409_000002'
down_revision: Union[str, None] = '20260408_000001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'AppealTicket',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('appName', sa.String(), nullable=False),
        sa.Column('pageUrl', sa.String(), nullable=True),
        sa.Column('issueType', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidenceUrls', sa.JSON(), nullable=True),
        sa.Column('contactEmail', sa.String(), nullable=False),
        sa.Column('ipHash', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('adminNote', sa.Text(), nullable=True),
        sa.Column('processedAt', sa.BIGINT(), nullable=True),
        sa.Column('createdAt', sa.BIGINT(), nullable=False),
        sa.Column('updatedAt', sa.BIGINT(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_AppealTicket_status', 'AppealTicket', ['status'], unique=False)
    op.create_index('ix_AppealTicket_createdAt', 'AppealTicket', ['createdAt'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_AppealTicket_createdAt', table_name='AppealTicket')
    op.drop_index('ix_AppealTicket_status', table_name='AppealTicket')
    op.drop_table('AppealTicket')
