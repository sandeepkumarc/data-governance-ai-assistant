#!/usr/bin/env python3
"""FastAPI backend server for the Data Governance AI SaaS Platform."""

from __future__ import annotations

import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(BACKEND_DIR))

from db.session import init_db
from middleware.auth import APIKeyMiddleware
from routers import audit, definitions, export, health, knowledge, lineage, quality, semantic, stewardship, trust


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Data Governance AI Platform API",
    description="Backend API serving Semantic Mapping, Lineage, Data Quality, and Stewardship features.",
    version="1.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(APIKeyMiddleware)

app.include_router(health.router)
app.include_router(knowledge.router)
app.include_router(semantic.router)
app.include_router(definitions.router)
app.include_router(audit.router)
app.include_router(export.router)
app.include_router(lineage.router)
app.include_router(quality.router)
app.include_router(trust.router)
app.include_router(stewardship.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
