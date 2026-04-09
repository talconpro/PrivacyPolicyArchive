from datetime import date, datetime, timezone

from sqlalchemy import BIGINT, Boolean, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from sqlalchemy.types import TypeDecorator

from app.db.session import Base


class PrismaDateTime(TypeDecorator):
    """Compat for Prisma SQLite timestamps stored as unix ms integers."""

    impl = BIGINT
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        if isinstance(value, date):
            dt = datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str):
            text = value.strip()
            if text.isdigit():
                return int(text)
            dt = datetime.fromisoformat(text.replace('Z', '+00:00'))
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value) / 1000.0, tz=timezone.utc)
        if isinstance(value, str):
            text = value.strip()
            if text.isdigit():
                return datetime.fromtimestamp(float(text) / 1000.0, tz=timezone.utc)
            return datetime.fromisoformat(text.replace('Z', '+00:00'))
        return value


class App(Base):
    __tablename__ = 'App'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    developer: Mapped[str | None] = mapped_column(String)
    iconUrl: Mapped[str | None] = mapped_column(String)
    privacyPolicyUrl: Mapped[str | None] = mapped_column(String)
    termsOfServiceUrl: Mapped[str | None] = mapped_column(String)
    rawText: Mapped[str | None] = mapped_column(Text)
    analysis: Mapped[dict | None] = mapped_column(JSON)
    analysisSource: Mapped[dict | None] = mapped_column(JSON)
    riskLevel: Mapped[str | None] = mapped_column(String)
    oneLiner: Mapped[str | None] = mapped_column(String)
    plainSummary: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String, default='draft')
    reviewNotes: Mapped[str | None] = mapped_column(Text)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    warningPinned: Mapped[bool] = mapped_column(Boolean, default=False)
    isPublished: Mapped[bool] = mapped_column(Boolean, default=False)
    sourceType: Mapped[str] = mapped_column(String, default='manual')
    sourceSubmissionId: Mapped[str | None] = mapped_column(String)
    analyzedAt: Mapped[datetime | None] = mapped_column(PrismaDateTime)
    updatedAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now(), onupdate=func.now())
    createdAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now())
    contentHash: Mapped[str | None] = mapped_column(String)
    lastFetchAt: Mapped[datetime | None] = mapped_column(PrismaDateTime)
    lastError: Mapped[str | None] = mapped_column(Text)


class PolicyVersion(Base):
    __tablename__ = 'PolicyVersion'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    appId: Mapped[str] = mapped_column(ForeignKey('App.id'))
    versionLabel: Mapped[str | None] = mapped_column(String)
    rawText: Mapped[str] = mapped_column(Text)
    contentHash: Mapped[str] = mapped_column(String)
    analysis: Mapped[dict | None] = mapped_column(JSON)
    diffSummary: Mapped[dict | None] = mapped_column(JSON)
    sourceUrl: Mapped[str | None] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now())


class UserSubmission(Base):
    __tablename__ = 'UserSubmission'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    appName: Mapped[str] = mapped_column(String)
    privacyUrl: Mapped[str] = mapped_column(String)
    termsUrl: Mapped[str | None] = mapped_column(String)
    remark: Mapped[str | None] = mapped_column(Text)
    submitterEmail: Mapped[str | None] = mapped_column(String)
    ipHash: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default='pending')
    fetchStatus: Mapped[str] = mapped_column(String, default='idle')
    analysisStatus: Mapped[str] = mapped_column(String, default='idle')
    adminNote: Mapped[str | None] = mapped_column(Text)
    processingError: Mapped[str | None] = mapped_column(Text)
    extractedText: Mapped[str | None] = mapped_column(Text)
    extractedHash: Mapped[str | None] = mapped_column(String)
    suggestedRisk: Mapped[str | None] = mapped_column(String)
    analysisDraft: Mapped[dict | None] = mapped_column(JSON)
    linkedAppId: Mapped[str | None] = mapped_column(String)
    createdAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now(), onupdate=func.now())
    approvedAt: Mapped[datetime | None] = mapped_column(PrismaDateTime)


class CrawlJob(Base):
    __tablename__ = 'CrawlJob'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    type: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default='queued')
    targetType: Mapped[str | None] = mapped_column(String)
    targetId: Mapped[str | None] = mapped_column(String)
    startedAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now())
    finishedAt: Mapped[datetime | None] = mapped_column(PrismaDateTime)
    summary: Mapped[str | None] = mapped_column(Text)
    log: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict | None] = mapped_column(JSON)


class AuditLog(Base):
    __tablename__ = 'AuditLog'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    appId: Mapped[str | None] = mapped_column(ForeignKey('App.id'))
    entityType: Mapped[str] = mapped_column(String)
    entityId: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    actor: Mapped[str] = mapped_column(String)
    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict | None] = mapped_column(JSON)
    createdAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now())


class AppealTicket(Base):
    __tablename__ = 'AppealTicket'

    id: Mapped[str] = mapped_column(String, primary_key=True)
    appName: Mapped[str] = mapped_column(String, nullable=False)
    pageUrl: Mapped[str | None] = mapped_column(String)
    issueType: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidenceUrls: Mapped[list[str] | None] = mapped_column(JSON)
    contactEmail: Mapped[str] = mapped_column(String, nullable=False)
    ipHash: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default='pending')
    adminNote: Mapped[str | None] = mapped_column(Text)
    processedAt: Mapped[datetime | None] = mapped_column(PrismaDateTime)
    createdAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now())
    updatedAt: Mapped[datetime] = mapped_column(PrismaDateTime, server_default=func.now(), onupdate=func.now())
