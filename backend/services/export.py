"""Collibra-compatible export for approved governance definitions."""

from __future__ import annotations

import csv
import io
from typing import Any

from sqlalchemy.orm import Session

from db.models import FieldDefinition, StewardAssignment

COLLIBRA_COLUMNS = [
    "Asset Type",
    "Asset Name",
    "Display Name",
    "Definition",
    "Domain",
    "Status",
    "Steward",
    "Business Owner",
    "Classification",
    "Sensitivity",
    "Logical Attribute Name",
    "Logical Attribute Description",
    "Source Database",
    "Source Table",
    "Source Column",
    "Glossary Term",
    "Glossary Term Definition",
    "Approval Status",
    "Steward Comment",
    "Approved By",
    "Field Definition ID",
]


def build_collibra_rows(
    session: Session,
    *,
    approval_status: str | None = None,
    database_name: str | None = None,
) -> list[dict[str, str]]:
    query = session.query(FieldDefinition).order_by(
        FieldDefinition.database_name,
        FieldDefinition.table_name,
        FieldDefinition.column_name,
    )
    if approval_status:
        query = query.filter(FieldDefinition.approval_status == approval_status)
    if database_name:
        query = query.filter(FieldDefinition.database_name == database_name)

    rows: list[dict[str, str]] = []
    for definition in query.all():
        steward = (
            session.query(StewardAssignment)
            .filter_by(
                database_name=definition.database_name,
                table_name=definition.table_name,
                column_name=definition.column_name,
            )
            .one_or_none()
        )
        asset_name = f"{definition.database_name}.{definition.table_name}.{definition.column_name}"
        rows.append(
            {
                "Asset Type": "Column",
                "Asset Name": asset_name,
                "Display Name": definition.logical_data_attribute_name or definition.column_name,
                "Definition": definition.definition,
                "Domain": definition.database_name,
                "Status": _collibra_status(definition.approval_status),
                "Steward": steward.data_steward if steward else "",
                "Business Owner": steward.business_owner if steward else "",
                "Classification": definition.data_classification,
                "Sensitivity": definition.sensitivity,
                "Logical Attribute Name": definition.logical_data_attribute_name,
                "Logical Attribute Description": definition.logical_data_attribute_description,
                "Source Database": definition.database_name,
                "Source Table": definition.table_name,
                "Source Column": definition.column_name,
                "Glossary Term": definition.glossary_term,
                "Glossary Term Definition": definition.glossary_term_description,
                "Approval Status": definition.approval_status,
                "Steward Comment": definition.steward_comment,
                "Approved By": definition.approved_by,
                "Field Definition ID": definition.id,
            }
        )
    return rows


def rows_to_csv(rows: list[dict[str, str]]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=COLLIBRA_COLUMNS)
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def _collibra_status(approval_status: str) -> str:
    mapping = {
        "approved": "Published",
        "rejected": "Rejected",
        "pending_review": "Candidate",
        "draft": "Draft",
    }
    return mapping.get(approval_status, "Candidate")
