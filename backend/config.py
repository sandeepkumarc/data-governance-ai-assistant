"""Application configuration and shared paths."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).parent.resolve()
DATA_DIR = BACKEND_DIR / "data"
KNOWLEDGE_BASE_PATH = BACKEND_DIR / "governance_knowledge.md"

DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{(DATA_DIR / 'governance.db').as_posix()}",
)

API_KEY = os.getenv("GOVERNANCE_API_KEY", "")
DEFAULT_EMBEDDING_MODEL = os.getenv("GOVERNANCE_EMBEDDING_MODEL", "nomic-embed-text")
DEFAULT_RETRIEVAL_MODE = os.getenv("GOVERNANCE_RETRIEVAL_MODE", "tfidf")
