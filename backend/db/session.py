"""Database engine, session factory, and startup initialization."""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, inspect, select, text
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


def _migrate_schema() -> None:
    """Lightweight SQLite migrations for columns added after first release."""
    inspector = inspect(engine)
    if inspector.has_table("quality_rules"):
        columns = {col["name"] for col in inspector.get_columns("quality_rules")}
        if "reasoning" not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE quality_rules ADD COLUMN reasoning TEXT DEFAULT ''"))

    if inspector.has_table("field_definitions"):
        fd_columns = {col["name"] for col in inspector.get_columns("field_definitions")}
        with engine.begin() as conn:
            if "policy_citations" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN policy_citations JSON"))
            if "decision_rationale" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN decision_rationale TEXT DEFAULT ''"))
            if "regulatory_tags" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN regulatory_tags JSON"))
            if "collibra_asset_id" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN collibra_asset_id VARCHAR(64) DEFAULT ''"))
            if "collibra_sync_status" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN collibra_sync_status VARCHAR(32) DEFAULT ''"))
            if "collibra_matches" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN collibra_matches JSON"))
            if "collibra_recommended_action" not in fd_columns:
                conn.execute(text("ALTER TABLE field_definitions ADD COLUMN collibra_recommended_action VARCHAR(32) DEFAULT ''"))

    if inspector.has_table("maturity_config"):
        mc_columns = {col["name"] for col in inspector.get_columns("maturity_config")}
        if "axis_principle_map" not in mc_columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE maturity_config ADD COLUMN axis_principle_map JSON"))


def init_db() -> None:
    """Create tables and seed starter data when the database is empty."""
    Base.metadata.create_all(bind=engine)
    _migrate_schema()
    with session_scope() as session:
        from services.governance_principles import ensure_default_principles
        from services.lineage_policies import ensure_default_policies
        from services.maturity_config import ensure_maturity_config

        ensure_default_policies(session)
        ensure_default_principles(session)
        ensure_maturity_config(session)

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
