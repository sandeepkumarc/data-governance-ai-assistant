# AI-Assisted Data Governance

A production-ready, local-first data governance platform that helps data stewards create draft metadata definitions using policy guidance from your knowledge base.

## Overview

AI-Assisted Data Governance reads CSV field metadata, retrieves relevant policy guidance from your knowledge base, masks sensitive samples, and drafts steward-ready definitions and classifications—with optional local LLM enrichment via Ollama.

Built for data stewards and governance teams who need policy-grounded metadata enrichment without sending prompts to a cloud LLM provider.

## Key Features

- **Local RAG**: Policy knowledge base (`backend/governance_knowledge.md`) with semantic retrieval
- **Local LLM**: Optional Ollama integration for enhanced drafting
- **Sample Masking**: Automatic sensitive value masking (identifiers, emails, financials, etc.)
- **Vector Search**: Semantic matching and abbreviation detection
- **Collibra Export**: CSV/JSON exports for data catalog integration
- **Steward Workflow**: Full approval/rejection workflow with audit trail

## Architecture

```
web-ui (React, :5173)  →  FastAPI backend (:8000)  →  SQLite governance.db
                               ↓
                          rag_governance.py
                               ↓
                      backend/governance_knowledge.md
                               ↓
                      Ollama (:11434) — optional
                        • gemma4:e2b (LLM)
                        • nomic-embed-text (embeddings)
```

## What It Does

1. **Ingests** CSV field metadata (database, table, column, type, samples, notes)
2. **Retrieves** relevant sections from `backend/governance_knowledge.md` (RAG)
3. **Masks** sensitive sample values before processing
4. **Drafts** glossary terms, classifications, sensitivity, governance actions
5. **Persists** definitions, lineage, quality rules, trust scores, audit log
6. **Supports** steward approval workflow and Collibra CSV export
7. **Lineage stitching** via `backend/lineage_knowledge.md` + `lineage_policies` DB table

## Why This Matters

Data stewards often need to define many fields with limited context. This assistant creates a first draft using metadata, sample-value patterns, and approved governance guidance. The output is intended for human review, not automatic publication.

## Quick Start

### Terminal 1 — Backend

```bash
cd backend && source ../.venv/bin/activate
unset DATABASE_URL                 # use SQLite unless Postgres is intentional
python -c "from db.session import init_db; init_db()"
uvicorn main:app --reload --port 8000
```

### Terminal 2 — Web UI

```bash
cd web-ui && npm install && npm run dev
```

Open: `http://127.0.0.1:5173`

### Alternative: One-command setup

```bash
./scripts/restart.sh          # API :8000 + UI :5173
```

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

## Output

Each result includes:

- `table_description`: Brief inferred description of the table
- `glossary_term`: Proposed business glossary term
- `glossary_term_description`: Business definition of the glossary term
- `logical_data_attribute_name`: Logical attribute name mapped from the column
- `logical_data_attribute_description`: Description of the logical attribute
- `definition`: One-sentence business definition of the field
- `likely_purpose`: How the field is likely used in business
- `data_classification`: e.g. Public, Internal, Confidential, Restricted
- `sensitivity`: Low, Medium, High
- `governance_actions`: Actionable governance checklist
- `retrieved_context`: Relevant knowledge-base section headers
- `sample_values_masked`: Boolean flag showing if values were masked
- `masking_reasons`: List of masking categories applied
- `source`: Method/model used to generate results

## Files

### Backend (FastAPI API)

- `backend/main.py` - FastAPI app entry
- `backend/rag_governance.py` - RAG engine, TF-IDF + vector retrieval, Ollama calls
- `backend/governance_knowledge.md` - Live policy knowledge base
- `backend/services/` - Modular services (knowledge, vector_store, semantic_mapping, etc.)
- `backend/routers/` - API endpoints
- `backend/data/governance.db` - SQLite database (gitignored)
- `backend/sample_metadata.csv` - Column-catalog format
- `backend/sample_healthcare_metadata.csv` - Healthcare example

### Web UI (React)

- `web-ui/` - Full React SPA with 10+ screens
- `web-ui/src/` - Source code
- `web-ui/public/` - Static assets

### Legacy Components (still supported)

- `streamlit_rag_app.py` - Streamlit UI (8 tabs)
- `governance_api_client.py` - Python HTTP client for Streamlit
- `README_STREAMLIT_RAG.md` - Detailed UI run guide

## Security Posture

- Runs locally for prototype testing
- Does not require a cloud LLM API
- Masks sensitive sample values before prompting
- Uses safe sample metadata for fast analysis
- Outputs are review artifacts, not final policy decisions

## Roadmap

- [x] Add business glossary term generation as a separate output
- [ ] Add approval status and steward comments
- [ ] Add vector search for semantic RAG retrieval
- [ ] Add Collibra export mapping
- [ ] Add audit logs for prompt/version/model/knowledge-base evidence

## Disclaimer

This is a prototype for governance workflow experimentation. Do not upload production-sensitive data unless approved by your organization and protected by appropriate controls.

## Screenshots

![Upload and settings](Pasted Graphic 1.pngg)

![Results table](Pasted Graphic 1.pngg)

![Dashboard](docs/images/Pasted\ Graphic\ 2.png)

![Knowledge Base](docs/images/Pasted\ Graphic\ 3.png)

![Semantic Mapping](docs/images/Pasted\ Graphic\ 4.png)

![Lineage View](docs/images/Pasted\ Graphic\ 5.png)

![Quality Rules](docs/images/Pasted\ Graphic\ 6.png)

![Trust Scores](docs/images/Pasted\ Graphic\ 7.png)

![Export Options](docs/images/Pasted\ Graphic\ 8.png)

![Audit Log](docs/images/Pasted\ Graphic\ 9.png)

![Settings](docs/images/Pasted\ Graphic\ 10.png)

## Further Documentation

- [docs/EXECUTIVE_OVERVIEW.md](docs/EXECUTIVE_OVERVIEW.md) - 15-slide executive presentation
- [docs/WINDOWS_INSTALL.md](docs/WINDOWS_INSTALL.md) - Windows laptop install guide
- [docs/PROJECT_HANDOFF.md](docs/PROJECT_HANDOFF.md) - Full project state, architecture, next steps
- [web-ui/README.md](web-ui/README.md) - React web UI documentation
- [AGENTS.md](AGENTS.md) - Instructions for AI assistants resuming work
