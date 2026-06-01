#!/usr/bin/env python3
"""Streamlit UI for the data-governance platform — backed by the FastAPI API."""

from __future__ import annotations

import csv
import io
import os
import sys
from pathlib import Path
from typing import Any

import streamlit as st
import streamlit.components.v1 as components

BACKEND_DIR = Path(__file__).parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from governance_api_client import DEFAULT_API_URL, GovernanceApiClient, GovernanceApiError
from services.lineage_viz import build_mermaid, build_pyvis_html, legend_markdown


DEFAULT_CONTEXT = (
    "This dataset contains database metadata, table names, column names, data types, "
    "sample values, and notes. The goal is to create data governance definitions, "
    "likely purpose, classification, sensitivity, and recommended governance actions."
)


def parse_metadata_csv(content: str) -> list[dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(content))
    required = {"database_name", "table_name", "column_name", "data_type", "sample_values"}
    missing = required - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"CSV file is missing columns: {', '.join(sorted(missing))}")

    fields: list[dict[str, Any]] = []
    for row in reader:
        sample_values = [
            value.strip()
            for value in (row.get("sample_values") or "").split("|")
            if value.strip()
        ]
        fields.append(
            {
                "database_name": (row.get("database_name") or "").strip(),
                "table_name": (row.get("table_name") or "").strip(),
                "column_name": (row.get("column_name") or "").strip(),
                "data_type": (row.get("data_type") or "").strip(),
                "sample_values": sample_values,
                "notes": (row.get("notes") or "").strip(),
            }
        )
    return fields


def field_to_preview_row(field: dict[str, Any]) -> dict[str, str]:
    return {
        "database_name": field["database_name"],
        "table_name": field["table_name"],
        "column_name": field["column_name"],
        "data_type": field["data_type"],
        "sample_values": " | ".join(field["sample_values"]),
        "notes": field["notes"],
    }


def result_to_flat_row(result: dict[str, Any]) -> dict[str, str]:
    governance_actions = result.get("governance_actions", [])
    retrieved_context = result.get("retrieved_context", [])
    masking_reasons = result.get("masking_reasons", [])

    return {
        "id": str(result.get("id", "")),
        "database_name": str(result.get("database_name", "")),
        "table_name": str(result.get("table_name", "")),
        "column_name": str(result.get("column_name", "")),
        "table_description": str(result.get("table_description", "")),
        "glossary_term": str(result.get("glossary_term", "")),
        "glossary_term_description": str(result.get("glossary_term_description", "")),
        "logical_data_attribute_name": str(result.get("logical_data_attribute_name", "")),
        "logical_data_attribute_description": str(result.get("logical_data_attribute_description", "")),
        "definition": str(result.get("definition", "")),
        "likely_purpose": str(result.get("likely_purpose", "")),
        "data_classification": str(result.get("data_classification", "")),
        "sensitivity": str(result.get("sensitivity", "")),
        "governance_actions": " | ".join(str(item) for item in governance_actions)
        if isinstance(governance_actions, list)
        else str(governance_actions),
        "retrieved_context": " | ".join(str(item) for item in retrieved_context)
        if isinstance(retrieved_context, list)
        else str(retrieved_context),
        "sample_values_masked": str(result.get("sample_values_masked", "")),
        "masking_reasons": " | ".join(str(item) for item in masking_reasons)
        if isinstance(masking_reasons, list)
        else str(masking_reasons),
        "source": str(result.get("source", "")),
        "llm_error": str(result.get("llm_error", "")),
        "approval_status": str(result.get("approval_status", "")),
        "steward_comment": str(result.get("steward_comment", "")),
        "approved_by": str(result.get("approved_by", "")),
        "approved_at": str(result.get("approved_at", "")),
        "created_at": str(result.get("created_at", "")),
    }


def rows_to_csv(rows: list[dict[str, str]]) -> str:
    if not rows:
        return ""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def render_result_card(row: dict[str, str]) -> None:
    title = f"{row['database_name']}.{row['table_name']}.{row['column_name']}"
    with st.expander(title, expanded=False):
        if row.get("id"):
            st.caption(f"Definition ID: `{row['id']}`")
        if row.get("approval_status"):
            st.markdown(f"**Approval status:** {row['approval_status']}")

        st.markdown(f"**Table Description:** {row['table_description']}")
        st.markdown(f"**Definition:** {row['definition']}")
        st.markdown(f"**Likely purpose:** {row['likely_purpose']}")

        st.markdown("---")
        col_glossary, col_logical = st.columns(2)
        with col_glossary:
            st.markdown("#### Glossary Term")
            st.markdown(f"**Term:** `{row['glossary_term']}`")
            st.markdown(f"**Description:** {row['glossary_term_description']}")
        with col_logical:
            st.markdown("#### Logical Attribute")
            st.markdown(f"**Name:** `{row['logical_data_attribute_name']}`")
            st.markdown(f"**Description:** {row['logical_data_attribute_description']}")

        st.markdown("---")
        col1, col2, col3 = st.columns(3)
        col1.metric("Classification", row["data_classification"] or "N/A")
        col2.metric("Sensitivity", row["sensitivity"] or "N/A")
        col3.metric("Source", row["source"] or "N/A")

        st.markdown("**Retrieved context**")
        st.write(row["retrieved_context"] or "No context retrieved.")

        if row.get("sample_values_masked"):
            st.markdown("**Sample masking**")
            st.write(f"Masked: {row['sample_values_masked']} | Reasons: {row['masking_reasons'] or 'N/A'}")

        st.markdown("**Governance actions**")
        st.write(row["governance_actions"] or "No actions returned.")

        if row.get("llm_error"):
            st.warning(f"LLM fallback used: {row['llm_error']}")


def render_analyze_tab(client: GovernanceApiClient, kb_sections: list[dict[str, str]]) -> None:
    st.caption("Upload field metadata and generate draft definitions through the FastAPI backend.")

    with st.sidebar:
        st.header("Run Settings")
        run_mode = st.radio(
            "Generation mode",
            options=["RAG + Local LLM", "RAG only"],
            help="RAG only uses retrieval and heuristics. RAG + Local LLM calls Ollama on the backend host.",
        )
        model = st.selectbox(
            "Ollama model",
            options=["gemma4:e2b", "gemma4:latest", "llama3:latest"],
            index=0,
            disabled=run_mode == "RAG only",
        )
        ollama_url = st.text_input(
            "Ollama URL",
            value="http://localhost:11434",
            disabled=run_mode == "RAG only",
        )
        max_rows = st.number_input(
            "Max rows to process",
            min_value=1,
            max_value=500,
            value=25,
            step=1,
        )
        mask_samples = st.checkbox("Mask sample values before processing", value=True)
        persist_results = st.checkbox(
            "Save results to database",
            value=True,
            help="Persist definitions and audit entries through the FastAPI backend.",
        )
        retrieval_mode = st.selectbox(
            "Retrieval mode",
            options=["tfidf", "vector"],
            help="Vector mode uses Ollama embeddings for semantic search. Falls back to TF-IDF if embeddings are unavailable.",
        )
        embedding_model = st.text_input(
            "Embedding model",
            value="nomic-embed-text",
            disabled=retrieval_mode != "vector",
        )

    input_col, kb_col = st.columns([1.05, 0.95])

    with input_col:
        st.subheader("1. Upload Metadata CSV")
        uploaded_file = st.file_uploader(
            "CSV columns: database_name, table_name, column_name, data_type, sample_values, notes",
            type=["csv"],
        )
        csv_context = st.text_area(
            "Dataset context for this test",
            value=DEFAULT_CONTEXT,
            height=130,
        )

    with kb_col:
        st.subheader("2. Knowledge Base")
        st.success(f"Backend loaded {len(kb_sections)} governance sections.")
        with st.expander("View knowledge base sections"):
            for section in kb_sections:
                st.markdown(f"- {section['title']}")

    if uploaded_file is None:
        st.info("Upload a metadata CSV to start. You can use `backend/sample_metadata.csv` as the first test file.")
        return

    try:
        fields = parse_metadata_csv(uploaded_file.getvalue().decode("utf-8"))
    except Exception as exc:
        st.error(f"Could not read uploaded CSV: {exc}")
        return

    fields = fields[: int(max_rows)]
    preview_rows = [field_to_preview_row(field) for field in fields]

    st.subheader("3. Preview Fields")
    if mask_samples:
        st.info("Sample values are masked on the backend before retrieval and LLM prompting.")
    st.dataframe(preview_rows, use_container_width=True, hide_index=True)

    if not st.button("Generate Definitions", type="primary"):
        return

    st.subheader("4. Results")
    with st.spinner("Calling FastAPI backend..."):
        try:
            results = client.analyze_metadata(
                fields,
                dataset_context=csv_context,
                mask_samples=mask_samples,
                no_llm=run_mode == "RAG only",
                provider="ollama",
                model=model,
                base_url=ollama_url,
                persist=persist_results,
                retrieval_mode=retrieval_mode,
                embedding_model=embedding_model,
            )
        except GovernanceApiError as exc:
            st.error(f"Backend request failed: {exc}")
            return

    flat_results = [result_to_flat_row(result) for result in results]
    st.success(f"Processed {len(flat_results)} field(s) via FastAPI.")
    st.dataframe(flat_results, use_container_width=True, hide_index=True)

    st.download_button(
        label="Download Results CSV",
        data=rows_to_csv(flat_results),
        file_name="data_governance_rag_results.csv",
        mime="text/csv",
    )

    st.subheader("Field Review")
    for row in flat_results:
        render_result_card(row)


def render_steward_review_tab(client: GovernanceApiClient) -> None:
    st.caption("Review persisted definitions and submit steward approvals.")

    filter_col1, filter_col2, filter_col3 = st.columns(3)
    with filter_col1:
        database_name = st.text_input("Filter by database", value="")
    with filter_col2:
        table_name = st.text_input("Filter by table", value="")
    with filter_col3:
        approval_status = st.selectbox(
            "Filter by approval status",
            options=["", "pending_review", "approved", "rejected", "draft"],
            index=0,
        )

    if st.button("Load Saved Definitions", type="primary"):
        try:
            definitions = client.list_definitions(
                database_name=database_name or None,
                table_name=table_name or None,
                approval_status=approval_status or None,
            )
            st.session_state["saved_definitions"] = definitions
        except GovernanceApiError as exc:
            st.error(f"Could not load definitions: {exc}")
            return

    definitions = st.session_state.get("saved_definitions", [])
    if not definitions:
        st.info("Load saved definitions from the backend to review and approve them.")
        return

    st.dataframe(
        [
            {
                "id": item.get("id", ""),
                "field": f"{item['database_name']}.{item['table_name']}.{item['column_name']}",
                "classification": item.get("data_classification", ""),
                "sensitivity": item.get("sensitivity", ""),
                "approval_status": item.get("approval_status", ""),
                "source": item.get("source", ""),
            }
            for item in definitions
        ],
        use_container_width=True,
        hide_index=True,
    )

    st.subheader("Approve or Reject")
    options = {
        f"{item['database_name']}.{item['table_name']}.{item['column_name']} ({item['id'][:8]}...)": item["id"]
        for item in definitions
    }
    selected_label = st.selectbox("Select definition", options=list(options.keys()))
    definition_id = options[selected_label]

    with st.form("approval_form"):
        decision = st.selectbox("Decision", options=["approved", "rejected", "pending_review", "draft"])
        steward_comment = st.text_area("Steward comment")
        approved_by = st.text_input("Approved by")
        submitted = st.form_submit_button("Submit Decision")

    if submitted:
        try:
            updated = client.approve_definition(
                definition_id,
                approval_status=decision,
                steward_comment=steward_comment,
                approved_by=approved_by,
            )
            st.success(
                f"Updated {updated['database_name']}.{updated['table_name']}.{updated['column_name']} "
                f"to `{updated['approval_status']}`."
            )
            st.session_state["saved_definitions"] = client.list_definitions(
                database_name=database_name or None,
                table_name=table_name or None,
                approval_status=approval_status or None,
            )
        except GovernanceApiError as exc:
            st.error(f"Approval failed: {exc}")


def render_ownership_tab(client: GovernanceApiClient) -> None:
    st.caption("Business owners and data stewards stored in the backend database.")

    if st.button("Load Ownership Records", type="primary"):
        try:
            st.session_state["ownership_records"] = client.list_ownership()
        except GovernanceApiError as exc:
            st.error(f"Could not load ownership records: {exc}")
            return

    records = st.session_state.get("ownership_records", [])
    if not records:
        st.info("Load ownership records from the backend.")
        return

    st.dataframe(records, use_container_width=True, hide_index=True)


def render_audit_tab(client: GovernanceApiClient) -> None:
    st.caption("Recent analysis runs and steward approval events.")

    action = st.selectbox(
        "Filter by action",
        options=["", "analyze_metadata", "upload_metadata", "approve_definition"],
        index=0,
    )

    if st.button("Load Audit Log", type="primary"):
        try:
            st.session_state["audit_log"] = client.list_audit_log(action=action or None)
        except GovernanceApiError as exc:
            st.error(f"Could not load audit log: {exc}")
            return

    entries = st.session_state.get("audit_log", [])
    if not entries:
        st.info("Load audit log entries from the backend.")
        return

    st.dataframe(entries, use_container_width=True, hide_index=True)


def render_lineage_tab(client: GovernanceApiClient) -> None:
    st.caption("Visual lineage graph synced from analyzed field definitions.")

    database_name = st.text_input("Filter lineage by database", value="")
    if st.button("Load Lineage Graph", type="primary"):
        try:
            st.session_state["lineage_graph"] = client.get_lineage(
                database_name=database_name or None
            )
        except GovernanceApiError as exc:
            st.error(f"Could not load lineage: {exc}")
            return

    graph = st.session_state.get("lineage_graph")
    if not graph:
        st.info("Run **Analyze** first with **Save results to database** enabled, then load the lineage graph.")
        return

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    metric_col1, metric_col2, metric_col3 = st.columns(3)
    metric_col1.metric("Nodes", len(nodes))
    metric_col2.metric("Edges", len(edges))
    metric_col3.metric("Databases", len({n.get("database_name") for n in nodes if n.get("database_name")}))

    st.markdown("#### How to read this graph")
    st.markdown(legend_markdown())

    st.markdown("#### Interactive lineage graph")
    st.caption("Scroll/zoom inside the graph. Hover a node for details. Arrows show data flow.")
    try:
        components.html(build_pyvis_html(graph), height=720, scrolling=True)
    except Exception as exc:
        st.warning(f"Interactive graph unavailable ({exc}). Showing Mermaid diagram instead.")
        st.markdown(f"```mermaid\n{build_mermaid(graph)}\n```")

    with st.expander("Mermaid diagram (copy into docs or GitHub)"):
        mermaid_text = graph.get("mermaid") or build_mermaid(graph)
        st.code(mermaid_text, language="text")
        st.markdown(
            "Paste the diagram above into [Mermaid Live Editor](https://mermaid.live) "
            "or any Markdown viewer that supports Mermaid."
        )

    with st.expander("Raw nodes and edges"):
        st.dataframe(nodes, use_container_width=True, hide_index=True)
        st.dataframe(edges, use_container_width=True, hide_index=True)


def render_quality_tab(client: GovernanceApiClient) -> None:
    st.caption("Quality rules auto-suggested from field classifications and column patterns.")

    filter_col1, filter_col2 = st.columns(2)
    with filter_col1:
        database_name = st.text_input("Quality filter: database", value="", key="quality_db")
    with filter_col2:
        table_name = st.text_input("Quality filter: table", value="", key="quality_tbl")

    if st.button("Load Quality Rules", type="primary"):
        try:
            st.session_state["quality_rules"] = client.list_quality_rules(
                database_name=database_name or None,
                table_name=table_name or None,
            )
        except GovernanceApiError as exc:
            st.error(f"Could not load quality rules: {exc}")
            return

    rules = st.session_state.get("quality_rules", [])
    if not rules:
        st.info("Analyze and persist field definitions to generate quality rules.")
        return

    st.dataframe(rules, use_container_width=True, hide_index=True)

    options = {
        f"{rule['table_name']}.{rule['column_name']} — {rule['rule_name']}": rule["id"]
        for rule in rules
    }
    selected = st.selectbox("Select rule to evaluate", options=list(options.keys()))
    rule_id = options[selected]
    new_status = st.selectbox("Set status", options=["Suggested", "Passed", "Warning", "Failed"])
    failure_count = st.number_input("Failure count", min_value=0, value=0, step=1)

    if st.button("Update Rule Status"):
        try:
            updated = client.update_quality_rule_status(
                rule_id,
                status=new_status,
                failure_count=int(failure_count),
            )
            st.success(f"Updated `{updated['rule_name']}` to {updated['status']}.")
            st.session_state["quality_rules"] = client.list_quality_rules(
                database_name=database_name or None,
                table_name=table_name or None,
            )
        except GovernanceApiError as exc:
            st.error(f"Update failed: {exc}")


def render_trust_tab(client: GovernanceApiClient) -> None:
    st.caption("Trust scores computed from definition completeness, approvals, and quality rules.")

    database_name = st.text_input("Trust filter: database", value="", key="trust_db")
    if st.button("Load Trust Scores", type="primary"):
        try:
            st.session_state["trust_scores"] = client.list_trust_scores(
                database_name=database_name or None
            )
        except GovernanceApiError as exc:
            st.error(f"Could not load trust scores: {exc}")
            return

    scores = st.session_state.get("trust_scores", [])
    if not scores:
        st.info("Analyze and persist definitions to compute trust scores.")
        return

    for score in scores:
        breakdown = score.get("breakdown", {})
        st.subheader(f"{score['database_name']}.{score['table_name']}")
        cols = st.columns(5)
        cols[0].metric("Overall", score.get("overall_score", 0))
        cols[1].metric("Completeness", breakdown.get("completeness", 0))
        cols[2].metric("Accuracy", breakdown.get("accuracy", 0))
        cols[3].metric("Freshness", breakdown.get("freshness", 0))
        cols[4].metric("Schema", breakdown.get("schema_consistency", 0))
        st.caption(
            f"Status: {score.get('status', 'Unknown')} | "
            f"Steward: {score.get('steward_assigned') or 'Unassigned'}"
        )


def render_export_tab(client: GovernanceApiClient) -> None:
    st.caption("Export approved definitions in Collibra-compatible CSV format.")

    approval_status = st.selectbox(
        "Approval filter",
        options=["", "approved", "pending_review", "rejected", "draft"],
        index=0,
    )
    database_name = st.text_input("Database filter", value="", key="export_db")

    if st.button("Generate Collibra Export", type="primary"):
        try:
            csv_text = client.export_collibra_csv(
                approval_status=approval_status or None,
                database_name=database_name or None,
            )
            st.session_state["collibra_export"] = csv_text
        except GovernanceApiError as exc:
            st.error(f"Export failed: {exc}")
            return

    export_text = st.session_state.get("collibra_export", "")
    if not export_text:
        st.info("Generate an export to download Collibra-ready CSV.")
        return

    st.download_button(
        label="Download Collibra CSV",
        data=export_text,
        file_name="collibra_export.csv",
        mime="text/csv",
    )
    st.text_area("Preview", value=export_text, height=240)


def main() -> None:
    st.set_page_config(page_title="Data Governance RAG Assistant", page_icon="DG", layout="wide")
    st.title("Data Governance RAG Assistant")
    st.caption("Streamlit frontend for the FastAPI data governance platform.")

    default_api_url = os.getenv("GOVERNANCE_API_URL", DEFAULT_API_URL)
    with st.sidebar:
        st.header("Backend Connection")
        api_url = st.text_input("FastAPI base URL", value=default_api_url)
        api_key = st.text_input("API key (optional)", value=os.getenv("GOVERNANCE_API_KEY", ""), type="password")
        client = GovernanceApiClient(api_url, api_key=api_key)

        try:
            health = client.health()
            st.success(f"Connected: {health.get('app', 'backend')}")
            kb_sections = client.knowledge_sections()
        except GovernanceApiError as exc:
            st.error(f"Backend unavailable: {exc}")
            st.stop()

    analyze_tab, steward_tab, ownership_tab, lineage_tab, quality_tab, trust_tab, export_tab, audit_tab = st.tabs(
        ["Analyze", "Steward Review", "Ownership", "Lineage", "Quality", "Trust", "Export", "Audit Log"]
    )

    with analyze_tab:
        render_analyze_tab(client, kb_sections)
    with steward_tab:
        render_steward_review_tab(client)
    with ownership_tab:
        render_ownership_tab(client)
    with lineage_tab:
        render_lineage_tab(client)
    with quality_tab:
        render_quality_tab(client)
    with trust_tab:
        render_trust_tab(client)
    with export_tab:
        render_export_tab(client)
    with audit_tab:
        render_audit_tab(client)


if __name__ == "__main__":
    main()
