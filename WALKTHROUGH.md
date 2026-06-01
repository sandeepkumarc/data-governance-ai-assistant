# Walkthrough: Data Governance FastAPI Backend

I have restructured the project to introduce a decoupled, production-grade **FastAPI** backend supporting all five modules of the target SaaS platform.

---

## 1. Files Added & Created

* **[requirements.txt](file:///Users/sandeepchintakunta/Documents/codex-python/backend/requirements.txt)**: Configures dependency versions for `fastapi`, `uvicorn`, and `python-multipart`.
* **[main.py](file:///Users/sandeepchintakunta/Documents/codex-python/backend/main.py)**: The core FastAPI application that orchestrates:
  * CSV/JSON parsing for semantic mapping analysis.
  * Integration with the local Markdown-based governance knowledge base.
  * Structured mock datasets for **Lineage**, **Data Quality Rules**, **Trust Scores**, and **Ownership/Stewardship**.
* **Copied Governance Engine Components** (`backend/rag_governance.py`, `backend/governance_knowledge.md`, and `backend/sample_metadata.csv`): Ensures the backend is completely self-contained in the `backend/` directory.

---

## 2. API Endpoint Specification

The backend server runs locally on **Port 8000** and serves the following endpoints:

| Endpoint | Method | Description | Output Fields |
| :--- | :--- | :--- | :--- |
| `/api/health` | `GET` | API health check. | `{"status": "ok", "app": "data-governance-backend"}` |
| `/api/analyze-metadata` | `POST` | Processes JSON payload of data fields through the RAG context/LLM. | Complete data governance definitions, logical attributes, and metadata. |
| `/api/upload-metadata` | `POST` | Accepts multi-part CSV uploads (same format as `sample_metadata.csv`). | Complete data governance definitions, logical attributes, and metadata. |
| `/api/lineage` | `GET` | Node-link diagram layout for databases, tables, and column flows. | Array of `nodes` and `edges` (JSON). |
| `/api/quality-rules` | `GET` | Rules definition lists and quality evaluation statuses. | Array of checks (ID, type, status, failures, timestamp). |
| `/api/trust-scores` | `GET` | Aggregated table trust percentages and completeness metrics. | Table statistics (overall, completeness, accuracy, freshness). |
| `/api/ownership` | `GET` | Mapping of assets to Business Owners and Data Stewards. | Owner names, emails, steward logs, and statuses. |

---

## 3. Running & Verifying Locally

To boot up the API server:

1. **Activate Environment & Install Packages:**
   ```bash
   source venv/bin/activate
   pip install -r backend/requirements.txt
   ```
2. **Start Uvicorn Server:**
   ```bash
   cd backend
   uvicorn main:app --reload --port 8000
   ```
3. **Verify via Interactive Swagger Docs:**
   Open [http://localhost:8000/docs](http://localhost:8000/docs) in your browser to interactively test every endpoint.

4. **Verify via CLI Curl:**
   ```bash
   curl -s http://localhost:8000/api/health
   curl -s http://localhost:8000/api/lineage
   ```
