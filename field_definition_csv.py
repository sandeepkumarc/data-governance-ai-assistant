#!/usr/bin/env python3
"""Simple CSV utility that asks Ollama/Gemma for data-governance definitions."""

from __future__ import annotations

import argparse
import csv
import json
import re
import urllib.error
import urllib.request
from pathlib import Path


DEFAULT_MODEL = "gemma4:e2b"
OLLAMA_URL = "http://localhost:11434/api/generate"


def split_name(value: str) -> str:
    words = re.sub(r"([a-z])([A-Z])", r"\1 \2", value)
    words = re.sub(r"[_\-.]+", " ", words)
    return " ".join(words.split()).lower()


def infer_context(row: dict[str, str]) -> str:
    database = split_name(row.get("database_name", ""))
    table = split_name(row.get("table_name", ""))
    column = split_name(row.get("column_name", ""))
    data_type = row.get("data_type", "")
    samples = row.get("sample_values", "")

    hints = [
        f"The field belongs to the {database} database." if database else "",
        f"The table appears to represent {table} records." if table else "",
        f"The column name reads as: {column}." if column else "",
        f"The field data type is {data_type}." if data_type else "",
        f"Sample values observed: {samples}." if samples else "",
    ]

    combined = " ".join([database, table, column, samples]).lower()
    if any(token in combined for token in ["email", "phone", "address", "dob", "birth", "name"]):
        hints.append("The field may contain personal or contact information.")
    if any(token in combined for token in ["salary", "payment", "card", "bank", "amount", "balance"]):
        hints.append("The field may contain financial or payment-related information.")
    if any(token in combined for token in ["token", "password", "secret", "session", "api key"]):
        hints.append("The field may contain security-sensitive information.")
    if any(token in combined for token in ["comment", "note", "description", "message", "feedback"]):
        hints.append("The field may contain free-form text with unpredictable sensitive content.")
    if any(token in combined for token in ["status", "state", "stage"]):
        hints.append("The field may describe workflow state or lifecycle status.")
    if re.search(r"(^|[\s_-])id($|[\s_-])", combined):
        hints.append("The field may be an identifier used to join or identify records.")

    return "\n".join(f"- {hint}" for hint in hints if hint)


def ask_llm(prompt: str, model: str) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.1},
    }

    request = urllib.request.Request(
        OLLAMA_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.loads(response.read().decode("utf-8"))
        return data["response"].strip()


def build_prompt(row: dict[str, str], csv_context: str) -> str:
    database = row.get("database_name", "")
    table = row.get("table_name", "")
    column = row.get("column_name", "")
    data_type = row.get("data_type", "")
    samples = row.get("sample_values", "")
    row_notes = row.get("notes", "")
    inferred_context = infer_context(row)

    return f"""
You are a data governance analyst.

Create a simple business definition for this database field.
Use the CSV-level context first because it describes the full dataset.
Then use row notes and inferred context to refine the definition for this specific field.

Database: {database}
Table: {table}
Column: {column}
Data type: {data_type}
Sample values: {samples}

CSV-level context:
{csv_context or "None provided."}

Row notes:
{row_notes or "None provided."}

Inferred context:
{inferred_context}

Return only valid JSON in this format:

{{
  "database_name": "{database}",
  "table_name": "{table}",
  "column_name": "{column}",
  "definition": "...",
  "likely_purpose": "...",
  "data_classification": "Public | Internal | Confidential | Restricted",
  "sensitivity": "Low | Medium | High",
  "context_used": "..."
}}
""".strip()


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        required = {"database_name", "table_name", "column_name", "data_type", "sample_values"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"CSV is missing required columns: {', '.join(sorted(missing))}")
        return [{key: value or "" for key, value in row.items()} for row in reader]


def parse_json(text: str) -> dict[str, object]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            raise
        return json.loads(text[start : end + 1])


def read_context(context: str, context_file: Path | None) -> str:
    if context_file:
        return context_file.read_text(encoding="utf-8").strip()
    return context.strip()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate field definitions from a CSV using Gemma/Ollama.")
    parser.add_argument("--input", required=True, type=Path, help="Input CSV file.")
    parser.add_argument("--output", default=Path("field_definitions.jsonl"), type=Path, help="Output JSONL file.")
    parser.add_argument("--model", default=DEFAULT_MODEL, help="Ollama model name.")
    parser.add_argument("--context", default="", help="Shared context that applies to the whole CSV.")
    parser.add_argument("--context-file", type=Path, help="Text file containing shared context for the whole CSV.")
    args = parser.parse_args()

    rows = read_csv(args.input)
    csv_context = read_context(args.context, args.context_file)

    with args.output.open("w", encoding="utf-8") as output:
        for index, row in enumerate(rows, start=1):
            print(f"Processing {index}/{len(rows)}: {row['table_name']}.{row['column_name']}")
            prompt = build_prompt(row, csv_context)

            try:
                response = ask_llm(prompt, args.model)
                result = parse_json(response)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                result = {
                    "database_name": row.get("database_name", ""),
                    "table_name": row.get("table_name", ""),
                    "column_name": row.get("column_name", ""),
                    "error": str(exc),
                }

            output.write(json.dumps(result, ensure_ascii=False) + "\n")

    print(f"Done. Results written to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
