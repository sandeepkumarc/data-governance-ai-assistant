"""Export routes — Collibra CSV and JSON."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from db.session import get_db
from services.export import build_collibra_rows, rows_to_csv

router = APIRouter(tags=["Export"])


@router.get("/api/export/collibra")
async def export_collibra(
    approval_status: str | None = Query(None, description="Filter e.g. approved"),
    database_name: str | None = Query(None),
    format: str = Query("csv"),
    db: Session = Depends(get_db),
) -> Any:
    """Export field definitions in a Collibra-compatible format."""
    if format not in {"csv", "json"}:
        format = "csv"
    rows = build_collibra_rows(
        db,
        approval_status=approval_status,
        database_name=database_name,
    )
    if format == "json":
        return rows
    csv_text = rows_to_csv(rows)
    return PlainTextResponse(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="collibra_export.csv"'},
    )
