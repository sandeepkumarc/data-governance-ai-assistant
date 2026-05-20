# Data Governance RAG Assistant UI

This Streamlit app lets data stewards test the RAG version without using command-line arguments.

## What The App Does

1. Upload a metadata CSV.
2. Add dataset context for the test run.
3. Load the governance knowledge base.
4. Mask sensitive sample values before processing.
5. Retrieve relevant governance context for each field.
6. Generate draft definitions and classifications.
7. Show results in a table.
8. Download results as CSV.

## Required CSV Columns

```csv
database_name,table_name,column_name,data_type,sample_values,notes
```

Use `|` between sample values:

```csv
customer_db,customers,email_address,string,alex@example.com|sam@company.com,Used for login
```

## Install Streamlit

From this folder:

```bash
python3 -m pip install -r requirements-streamlit.txt
```

On Windows, use:

```powershell
python -m pip install -r requirements-streamlit.txt
```

## Start Ollama

For full LLM testing, make sure Ollama has a local model:

```bash
ollama list
```

If needed:

```bash
ollama pull gemma4:e2b
```

The app also has a `RAG only` mode that does not call Ollama.

## Sample Value Masking

The app defaults to masking sample values before retrieval and LLM prompting. It detects common sensitive patterns and field names, including:

- identifiers
- contact values
- birth dates
- financial values
- tokens or secrets
- regulated identifiers
- free-text comments or notes

The output CSV includes:

```csv
sample_values_masked,masking_reasons
```

This lets stewards see whether masking was applied without exposing the original sensitive examples.

## Run The App

Mac:

```bash
streamlit run streamlit_rag_app.py
```

Windows:

```powershell
streamlit run streamlit_rag_app.py
```

Then open the browser URL shown by Streamlit, usually:

```text
http://localhost:8501
```

## Recommended First Test

1. Upload `sample_metadata.csv`.
2. Leave the knowledge base as `governance_knowledge.md`.
3. Start with `RAG only` mode.
4. Click `Generate Definitions`.
5. Review `retrieved_context`.
6. Download the result CSV.
7. Switch to `RAG + Local LLM` when Ollama is ready.
