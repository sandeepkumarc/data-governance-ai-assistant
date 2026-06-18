# AI-Assisted Data Governance — Data Governance Platform

A production-oriented, local-first data governance platform. AI-Assisted Data Governance reads field metadata, retrieves approved policy guidance from your knowledge base, masks sensitive samples, and drafts steward-ready definitions and classifications—with optional local LLM enrichment via Ollama.

Built for data stewards and governance teams who need policy-grounded metadata enrichment without sending prompts to a cloud LLM provider.

## Documentation (executive overview & handoff)

| Doc | Purpose |
|-----|---------|
| [docs/EXECUTIVE_OVERVIEW.md](docs/EXECUTIVE_OVERVIEW.md) | 15-slide executive presentation + walkthrough script |
| [docs/WINDOWS_INSTALL.md](docs/WINDOWS_INSTALL.md) | Windows laptop install for presentation day |
| [docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md) | Full project state, architecture, next steps (AI/human continuity) |
| [web-ui/README.md](web-ui/README.md) | AI-Assisted Data Governance React web UI |
| [AGENTS.md](AGENTS.md) | Instructions for AI assistants resuming work |

## What It Does

- Upload or process CSV metadata for database fields.
- Reads database name, table name, column name, data type, sample values, and notes.
- Masks sensitive sample values before retrieval and prompting.
- Retrieves relevant sections from a local governance knowledge base.
- Generates draft field definitions, likely purpose, classification, sensitivity, and governance actions.
- Supports RAG-only mode without an LLM.
- Supports local LLM generation through Ollama.
- Provides a Streamlit UI for steward testing and CSV download.

## Why This Matters

Data stewards often need to define many fields with limited context. This assistant creates a first draft using metadata, sample-value patterns, and approved governance guidance. The output is intended for human review, not automatic publication.

## Architecture

```text
Metadata CSV
  + dataset context
  + governance_knowledge.md
        |
        v
Sample value masking
        |
        v
RAG retrieval over governance guidance
        |
        v
RAG only fallback or local Gemma/Llama through Ollama
        |
        v
Draft definitions + classifications + CSV download
```

## Key Features

### Local RAG

`governance_knowledge.md` acts as the local knowledge base. The script splits it into sections by `##` headings and retrieves the most relevant sections for each field using token similarity.

### Local LLM

The app can call Ollama at:

```text
http://localhost:11434
```

This keeps inference local when using models such as `gemma4:e2b`, `gemma4:latest`, or `llama3:latest`.

### Sample Value Masking

Sensitive samples are masked before retrieval and prompting. Examples:

```text
customer_id       -> [IDENTIFIER_VALUE]
email_address     -> [CONTACT_VALUE]
date_of_birth     -> YYYY-MM-DD
payment_token     -> [TOKEN_OR_SECRET_VALUE]
salary            -> [FINANCIAL_VALUE]
customer_comments -> [FREE_TEXT_VALUE]
```

The downloaded CSV includes masking status and masking reasons.

## Files

- `streamlit_rag_app.py` - steward-friendly Streamlit UI
- `rag_governance.py` - RAG engine and command-line utility
- `governance_knowledge.md` - local governance knowledge base
- `clinical_ehr_patients.csv` - practical table export for demos (header row + sample records)
- `sample_metadata.csv` - column-catalog format (still supported for bulk metadata)
- `requirements-streamlit.txt` - Streamlit dependency
- `README_STREAMLIT_RAG.md` - detailed UI run guide

## Input Format

CSV columns:

```csv
database_name,table_name,column_name,data_type,sample_values,notes
```

Use `|` between sample values.

Example:

```csv
customer_db,customers,email_address,string,alex@example.com|sam@company.com,Used for customer login and notifications
```

## Run The Streamlit UI

Install dependency:

```bash
python3 -m pip install -r requirements-streamlit.txt
```

Start the app:

```bash
streamlit run streamlit_rag_app.py
```

Open:

```text
http://localhost:8501
```

Recommended first test:

1. Upload `clinical_ehr_patients.csv` (or any table export with a few sample rows).
2. Keep `governance_knowledge.md` as the knowledge base.
3. Start with `RAG only`.
4. Generate results.
5. Review retrieved context and masking reasons.
6. Download the CSV.

## Run From Command Line

RAG only:

```bash
python3 rag_governance.py --metadata sample_metadata.csv --no-llm --mask-samples
```

RAG + local Ollama model:

```bash
python3 rag_governance.py \
  --metadata sample_metadata.csv \
  --provider ollama \
  --model gemma4:e2b \
  --mask-samples
```

Save output:

```bash
python3 rag_governance.py \
  --metadata sample_metadata.csv \
  --provider ollama \
  --model gemma4:e2b \
  --mask-samples \
  > rag_results.jsonl
```

## Output

Each result includes:

- `table_description` (Brief inferred description of the table)
- `glossary_term` (Proposed business glossary term)
- `glossary_term_description` (Business definition of the glossary term)
- `logical_data_attribute_name` (Logical attribute name mapped from the column)
- `logical_data_attribute_description` (Description of the logical attribute)
- `definition` (One-sentence business definition of the field)
- `likely_purpose` (How the field is likely used in business)
- `data_classification` (e.g. Public, Internal, Confidential, Restricted)
- `sensitivity` (Low, Medium, High)
- `governance_actions` (Actionable governance checklist)
- `retrieved_context` (Relevant knowledge-base section headers)
- `sample_values_masked` (Boolean flag showing if values were masked)
- `masking_reasons` (List of masking categories applied)
- `source` (Method/model used to generate results)

## Steward Review Model

The assistant creates draft suggestions. A data steward should review and approve definitions before they are published to a business glossary, data catalog, Collibra, or downstream governance workflow.

## Security Posture

- Runs locally for prototype testing.
- Does not require a cloud LLM API.
- Masks sensitive sample values before prompting.
- Uses safe sample metadata for fast analysis.
- Outputs are review artifacts, not final policy decisions.

## Screenshots
![Upload and settings](docs/images/Screenshot1.png)

![Results table](docs/images/Screenshot2.png)

## Roadmap

- [x] Add business glossary term generation as a separate output.
- Add approval status and steward comments.
- Add vector search for semantic RAG retrieval.
- Add Collibra export mapping.
- Add audit logs for prompt/version/model/knowledge-base evidence.

## Disclaimer

This is a prototype for governance workflow experimentation. Do not upload production-sensitive data unless approved by your organization and protected by appropriate controls.
