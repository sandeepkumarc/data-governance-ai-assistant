"""Application configuration and shared paths."""

from __future__ import annotations

import os
from pathlib import Path

APP_NAME = "AI-Assisted Data Governance"

BACKEND_DIR = Path(__file__).parent.resolve()
DATA_DIR = BACKEND_DIR / "data"
KNOWLEDGE_BASE_PATH = BACKEND_DIR / "governance_knowledge.md"
LINEAGE_KNOWLEDGE_PATH = BACKEND_DIR / "lineage_knowledge.md"

DATA_DIR.mkdir(exist_ok=True)

# Legacy one-time import path; active policies live in governance.db (lineage_policies table)
LINEAGE_POLICIES_PATH = DATA_DIR / "lineage_policies.json"
GOVERNANCE_PRINCIPLES_PATH = DATA_DIR / "governance_principles.json"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(DATA_DIR / 'governance.db').as_posix()}",
)

API_KEY = os.getenv("GOVERNANCE_API_KEY", "")
DEFAULT_EMBEDDING_MODEL = os.getenv("GOVERNANCE_EMBEDDING_MODEL", "nomic-embed-text")
DEFAULT_RETRIEVAL_MODE = os.getenv("GOVERNANCE_RETRIEVAL_MODE", "tfidf")

# Collibra (REST; same capabilities as chip MCP — see docs/COLLIBRA_MCP_INTEGRATION.md)
COLLIBRA_ENABLED = os.getenv("COLLIBRA_ENABLED", "").lower() in {"1", "true", "yes"}
COLLIBRA_API_URL = os.getenv("COLLIBRA_API_URL", "").strip()
COLLIBRA_API_USERNAME = os.getenv("COLLIBRA_API_USERNAME", "").strip()
COLLIBRA_API_PASSWORD = os.getenv("COLLIBRA_API_PASSWORD", "").strip()
COLLIBRA_GLOSSARY_DOMAIN_NAME = os.getenv("COLLIBRA_GLOSSARY_DOMAIN_NAME", "Business Glossary")
COLLIBRA_BUSINESS_TERM_TYPE_NAME = os.getenv("COLLIBRA_BUSINESS_TERM_TYPE_NAME", "Business Term")
COLLIBRA_AUTO_PUSH_ON_APPROVE = os.getenv("COLLIBRA_AUTO_PUSH_ON_APPROVE", "").lower() in {"1", "true", "yes"}
COLLIBRA_MCP_CHIP_PATH = os.getenv("COLLIBRA_MCP_CHIP_PATH", "").strip()
