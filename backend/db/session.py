"""Database engine, session factory, and startup initialization."""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from config import DATABASE_URL, KNOWLEDGE_BASE_PATH
from db.models import Base, LineageEdge, LineageNode, StewardAssignment

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

SEED_STEWARDSHIP = [
    {
        "database_name": "customer_db",
        "table_name": "customers",
        "column_name": "customer_id",
        "business_owner": "Sarah Jenkins",
        "business_owner_email": "sarah.jenkins@company.com",
        "data_steward": "Alex Rivera",
        "data_steward_email": "alex.rivera@company.com",
        "lifecycle_status": "Approved",
        "notes": "Core profile primary identifier.",
    },
    {
        "database_name": "customer_db",
        "table_name": "customers",
        "column_name": "email_address",
        "business_owner": "Sarah Jenkins",
        "business_owner_email": "sarah.jenkins@company.com",
        "data_steward": "Alex Rivera",
        "data_steward_email": "alex.rivera@company.com",
        "lifecycle_status": "Approved",
        "notes": "PII classification review is completed.",
    },
    {
        "database_name": "customer_db",
        "table_name": "payments",
        "column_name": "payment_token",
        "business_owner": "Michael Chang",
        "business_owner_email": "michael.chang@company.com",
        "data_steward": "Sarah Jenkins",
        "data_steward_email": "sarah.jenkins@company.com",
        "lifecycle_status": "Reviewed",
        "notes": "Token references sensitive payout routes.",
    },
]


SEED_LINEAGE_REPORTS = [
    {
        "id": "report_sales",
        "label": "Sales & Revenue Dashboard",
        "node_type": "report",
        "details": "Looker Executive Report",
    },
    {
        "id": "report_audit",
        "label": "GDPR Compliance Ledger",
        "node_type": "report",
        "details": "Securities audit log",
    },
]


def init_db() -> None:
    """Create tables and seed starter data when the database is empty."""
    Base.metadata.create_all(bind=engine)
    with session_scope() as session:
        if session.scalar(select(StewardAssignment.id).limit(1)) is None:
            for row in SEED_STEWARDSHIP:
                session.add(StewardAssignment(**row))

        for row in SEED_LINEAGE_REPORTS:
            if session.get(LineageNode, row["id"]) is None:
                session.add(LineageNode(**row))


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def knowledge_base_version() -> str:
    if not KNOWLEDGE_BASE_PATH.exists():
        return "missing"
    return str(int(KNOWLEDGE_BASE_PATH.stat().st_mtime))
