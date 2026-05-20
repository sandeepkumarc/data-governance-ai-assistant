#!/usr/bin/env python3
"""Streamlit UI for the local data-governance RAG prototype."""

from __future__ import annotations

import csv
import io
import tempfile
from pathlib import Path

import streamlit as st

from rag_governance import (
    FieldMetadata,
    analyze_field,
    mask_field_samples,
    read_knowledge_base,
    read_metadata,
)


DEFAULT_CONTEXT = (
    "This dataset contains database metadata, table names, column names, data types, "
    "sample values, and notes. The goal is to create data governance definitions, "
    "likely purpose, classification, sensitivity, and recommended governance actions."
)


def write_uploaded_file(uploaded_file) -> Path:
    suffix = Path(uploaded_file.name).suffix or ".csv"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as handle:
        handle.write(uploaded_file.getvalue())
        return Path(handle.name)


def field_to_row(field: FieldMetadata) -> dict[str, str]:
    return {
        "database_name": field.database_name,
        "table_name": field.table_name,
        "column_name": field.column_name,
        "data_type": field.data_type,
        "sample_values": " | ".join(field.sample_values),
        "notes": field.notes,
    }


def result_to_flat_row(result: dict[str, object]) -> dict[str, str]:
    governance_actions = result.get("governance_actions", [])
    retrieved_context = result.get("retrieved_context", [])

    return {
        "database_name": str(result.get("database_name", "")),
        "table_name": str(result.get("table_name", "")),
        "column_name": str(result.get("column_name", "")),
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
        "masking_reasons": " | ".join(str(item) for item in result.get("masking_reasons", []))
        if isinstance(result.get("masking_reasons", []), list)
        else str(result.get("masking_reasons", "")),
        "source": str(result.get("source", "")),
        "llm_error": str(result.get("llm_error", "")),
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
        st.markdown(f"**Definition:** {row['definition']}")
        st.markdown(f"**Likely purpose:** {row['likely_purpose']}")

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


def main() -> None:
    st.set_page_config(
        page_title="Data Governance RAG Assistant",
        page_icon="DG",
        layout="wide",
    )

    st.title("Data Governance RAG Assistant")
    st.caption("Upload field metadata, retrieve governance guidance, generate draft definitions, and download results.")

    with st.sidebar:
        st.header("Run Settings")
        run_mode = st.radio(
            "Generation mode",
            options=["RAG + Local LLM", "RAG only"],
            help="RAG only uses retrieval and deterministic fallback logic. RAG + Local LLM calls Ollama.",
        )

        model = st.selectbox(
            "Ollama model",
            options=["gemma4:e2b", "gemma4:latest", "llama3:latest"],
            index=0,
            disabled=run_mode == "RAG only",
        )

        base_url = st.text_input(
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
            help="Keep this small during early testing.",
        )

        mask_samples = st.checkbox(
            "Mask sample values before processing",
            value=True,
            help="Recommended. Masks detected emails, dates, tokens, phone numbers, payment-like numbers, SSNs, and numeric values before retrieval and LLM prompting.",
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
            help="This context is added to the uploaded fields as business guidance for the run.",
        )

    with kb_col:
        st.subheader("2. Knowledge Base")
        knowledge_base_path = st.text_input("Knowledge base file", value="governance_knowledge.md")

        try:
            chunks = read_knowledge_base(Path(knowledge_base_path))
            st.success(f"Loaded {len(chunks)} governance sections.")
            with st.expander("View knowledge base sections"):
                for chunk in chunks:
                    st.markdown(f"- {chunk.title}")
        except Exception as exc:
            chunks = []
            st.error(f"Could not load knowledge base: {exc}")

    if uploaded_file is None:
        st.info("Upload a metadata CSV to start. You can use sample_metadata.csv as the first test file.")
        return

    try:
        metadata_path = write_uploaded_file(uploaded_file)
        fields = read_metadata(metadata_path)
    except Exception as exc:
        st.error(f"Could not read uploaded CSV: {exc}")
        return

    if csv_context.strip():
        fields = [
            FieldMetadata(
                database_name=field.database_name,
                table_name=field.table_name,
                column_name=field.column_name,
                data_type=field.data_type,
                sample_values=field.sample_values,
                notes=f"{field.notes} | Dataset context: {csv_context.strip()}".strip(" |"),
            )
            for field in fields
        ]

    masking_reports: dict[str, dict[str, object]] = {}
    if mask_samples:
        masked_fields = []
        for field in fields:
            masked_field, report = mask_field_samples(field)
            masking_reports[f"{field.database_name}.{field.table_name}.{field.column_name}"] = report
            masked_fields.append(masked_field)
        fields = masked_fields

    fields = fields[: int(max_rows)]
    preview_rows = [field_to_row(field) for field in fields]

    st.subheader("3. Preview Fields")
    if mask_samples:
        st.info("Sample values shown below are masked before retrieval and LLM prompting.")
    st.dataframe(preview_rows, use_container_width=True, hide_index=True)

    run = st.button("Generate Definitions", type="primary", disabled=not chunks)
    if not run:
        return

    st.subheader("4. Results")
    progress = st.progress(0)
    status = st.empty()
    flat_results: list[dict[str, str]] = []

    for index, field in enumerate(fields, start=1):
        status.write(f"Processing {index}/{len(fields)}: {field.table_name}.{field.column_name}")
        result = analyze_field(
            field=field,
            chunks=chunks,
            provider="ollama",
            model=model,
            base_url=base_url,
            no_llm=run_mode == "RAG only",
        )
        result.update(masking_reports.get(f"{field.database_name}.{field.table_name}.{field.column_name}", {}))
        flat_results.append(result_to_flat_row(result))
        progress.progress(index / len(fields))

    status.success("Processing complete.")

    st.dataframe(flat_results, use_container_width=True, hide_index=True)

    csv_output = rows_to_csv(flat_results)
    st.download_button(
        label="Download Results CSV",
        data=csv_output,
        file_name="data_governance_rag_results.csv",
        mime="text/csv",
    )

    st.subheader("Field Review")
    for row in flat_results:
        render_result_card(row)


if __name__ == "__main__":
    main()
