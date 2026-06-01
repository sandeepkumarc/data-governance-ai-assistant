#!/usr/bin/env bash
# End-to-end smoke tests for Data Governance platform
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API="${GOVERNANCE_API_URL:-http://localhost:8000}"
PASS=0
FAIL=0
SKIP=0

green() { printf '\033[32m%s\033[0m\n' "$1"; }
red()   { printf '\033[31m%s\033[0m\n' "$1"; }
yellow(){ printf '\033[33m%s\033[0m\n' "$1"; }

pass() { PASS=$((PASS + 1)); green "  PASS  $1"; }
fail() { FAIL=$((FAIL + 1)); red   "  FAIL  $1"; [ -n "${2:-}" ] && red "        $2"; }
skip() { SKIP=$((SKIP + 1)); yellow "  SKIP  $1"; [ -n "${2:-}" ] && yellow "        $2"; }

section() { echo; echo "=== $1 ==="; }

json_ok() {
  python3 -c "import json,sys; json.load(sys.stdin)" >/dev/null 2>&1
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$@"
}

# ---------------------------------------------------------------------------
section "1. Python environment"
if "$ROOT/.venv/bin/python3" -c "import sqlalchemy; import fastapi; import uvicorn" 2>/dev/null; then
  pass "venv imports (sqlalchemy, fastapi, uvicorn)"
else
  fail "venv imports" "Run: pip install -r backend/requirements.txt"
fi

# ---------------------------------------------------------------------------
section "2. Database"
if "$ROOT/.venv/bin/python3" -c "
import sys; sys.path.insert(0, '$ROOT/backend')
from db.session import init_db, SessionLocal
from sqlalchemy import text
init_db()
s = SessionLocal()
tables = s.execute(text(\"SELECT name FROM sqlite_master WHERE type='table'\")).fetchall()
assert any('field_definitions' in t[0] for t in tables), 'missing field_definitions'
s.close()
" 2>/dev/null; then
  pass "init_db + field_definitions table exists"
else
  fail "init_db / SQLite tables"
fi

ollama_has_model() {
  curl -sf http://localhost:11434/api/tags 2>/dev/null | python3 -c "
import json, sys
needle = sys.argv[1]
models = [m.get('name', '') for m in json.load(sys.stdin).get('models', [])]
sys.exit(0 if any(needle in n for n in models) else 1)
" "$1"
}

# ---------------------------------------------------------------------------
section "3. Ollama models"
if curl -sf http://localhost:11434/api/tags | json_ok; then
  pass "Ollama API reachable (localhost:11434)"
  if ollama_has_model "gemma4:e2b"; then
    pass "Ollama has gemma4:e2b"
  else
    fail "Ollama gemma4:e2b" "Run: ollama pull gemma4:e2b"
  fi
  if ollama_has_model "nomic-embed-text"; then
    pass "Ollama has nomic-embed-text"
  else
    fail "Ollama nomic-embed-text" "Run: ollama pull nomic-embed-text"
  fi
else
  skip "Ollama model checks" "Start Ollama app or run: ollama serve"
fi

# ---------------------------------------------------------------------------
section "4. Backend health"
CODE=$(http_code "$API/api/health")
BODY=$(curl -sf "$API/api/health" 2>/dev/null || true)
if [ "$CODE" = "200" ] && echo "$BODY" | json_ok && echo "$BODY" | grep -q '"status":"ok"'; then
  pass "GET /api/health"
else
  fail "GET /api/health" "HTTP $CODE — start backend: cd backend && uvicorn main:app --reload --port 8000"
  echo
  red "Backend not reachable — skipping API tests."
  echo
  echo "Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
  exit 1
fi

# ---------------------------------------------------------------------------
section "5. Analyze metadata (JSON)"
# 5a persist=false (no DB write)
RESP=$(curl -sf -X POST "$API/api/analyze-metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [{
      "database_name": "customer_db",
      "table_name": "customers",
      "column_name": "email_address",
      "data_type": "string",
      "sample_values": ["alex@example.com"],
      "notes": "Used for login"
    }],
    "no_llm": true,
    "persist": false,
    "retrieval_mode": "tfidf"
  }' 2>/dev/null || true)
if echo "$RESP" | json_ok && echo "$RESP" | grep -q "email_address"; then
  pass "POST /api/analyze-metadata (persist=false, tfidf, no_llm)"
else
  fail "POST /api/analyze-metadata persist=false" "Response: ${RESP:0:120}"
fi

# 5b persist=true (DB write — was failing with 500 / json.tool error)
RESP=$(curl -sf -X POST "$API/api/analyze-metadata" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": [{
      "database_name": "customer_db",
      "table_name": "customers",
      "column_name": "email_address",
      "data_type": "string",
      "sample_values": ["alex@example.com"],
      "notes": "Used for login"
    }],
    "no_llm": true,
    "persist": true,
    "retrieval_mode": "tfidf"
  }' 2>/dev/null || true)
if echo "$RESP" | json_ok && echo "$RESP" | grep -q '"id"'; then
  pass "POST /api/analyze-metadata (persist=true, tfidf, no_llm)"
  DEF_ID=$(echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if isinstance(d,list) else d.get('id',''))" 2>/dev/null || true)
else
  fail "POST /api/analyze-metadata persist=true" "Response: ${RESP:0:120}"
  DEF_ID=""
fi

# ---------------------------------------------------------------------------
section "6. Upload metadata (CSV)"
CSV="$ROOT/backend/sample_metadata.csv"
if [ -f "$CSV" ]; then
  RESP=$(curl -sf -X POST "$API/api/upload-metadata" \
    -F "file=@$CSV" \
    -F "no_llm=true" \
    -F "persist=true" \
    -F "retrieval_mode=tfidf" 2>/dev/null || true)
  if echo "$RESP" | json_ok && echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if len(d)>0 else 1)" 2>/dev/null; then
    pass "POST /api/upload-metadata (CSV bulk, persist=true)"
  else
    fail "POST /api/upload-metadata" "Response: ${RESP:0:120}"
  fi
else
  skip "POST /api/upload-metadata" "sample_metadata.csv not found"
fi

# ---------------------------------------------------------------------------
section "7. Definitions & approval"
RESP=$(curl -sf "$API/api/definitions" 2>/dev/null || true)
if echo "$RESP" | json_ok && echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if len(d)>0 else 1)" 2>/dev/null; then
  pass "GET /api/definitions"
else
  fail "GET /api/definitions"
fi

CODE=$(http_code "$API/api/definitions?database_name=customer_db")
[ "$CODE" = "200" ] && pass "GET /api/definitions?database_name=customer_db" || fail "definitions filter database_name" "HTTP $CODE"

CODE=$(http_code "$API/api/definitions?approval_status=pending_review")
[ "$CODE" = "200" ] && pass "GET /api/definitions?approval_status=pending_review" || fail "definitions filter approval_status" "HTTP $CODE"

if [ -n "${DEF_ID:-}" ]; then
  CODE=$(http_code "$API/api/definitions/$DEF_ID")
  [ "$CODE" = "200" ] && pass "GET /api/definitions/{id}" || fail "GET /api/definitions/{id}" "HTTP $CODE"

  RESP=$(curl -sf -X PATCH "$API/api/definitions/$DEF_ID/approve" \
    -H "Content-Type: application/json" \
    -d '{"approval_status":"approved","steward_comment":"Smoke test","approved_by":"tester"}' 2>/dev/null || true)
  if echo "$RESP" | json_ok && echo "$RESP" | grep -q '"approval_status":"approved"'; then
    pass "PATCH /api/definitions/{id}/approve"
  else
    fail "PATCH /api/definitions/{id}/approve" "${RESP:0:120}"
  fi
else
  skip "definition get/approve" "no definition id from analyze step"
fi

CODE=$(http_code "$API/api/definitions/DEFINITION_ID")
[ "$CODE" = "404" ] && pass "GET /api/definitions/DEFINITION_ID returns 404" || fail "bad definition id should 404" "HTTP $CODE"

# ---------------------------------------------------------------------------
section "8. Audit log"
for Q in "" "?action=analyze_metadata" "?action=upload_metadata" "?limit=10"; do
  CODE=$(http_code "$API/api/audit-log$Q")
  [ "$CODE" = "200" ] && pass "GET /api/audit-log$Q" || fail "GET /api/audit-log$Q" "HTTP $CODE"
done

# ---------------------------------------------------------------------------
section "9. Ownership / stewardship"
RESP=$(curl -sf "$API/api/ownership" 2>/dev/null || true)
if echo "$RESP" | json_ok; then
  pass "GET /api/ownership"
else
  fail "GET /api/ownership"
fi

CODE=$(http_code -X POST "$API/api/ownership" \
  -H "Content-Type: application/json" \
  -d '{"database_name":"customer_db","table_name":"customers","column_name":"test_col","data_steward":"Smoke Tester","lifecycle_status":"Draft"}')
[ "$CODE" = "200" ] && pass "POST /api/ownership" || fail "POST /api/ownership" "HTTP $CODE"

# ---------------------------------------------------------------------------
section "10. Lineage, quality, trust"
for EP in "/api/lineage" "/api/quality-rules" "/api/trust-scores"; do
  RESP=$(curl -sf "$API$EP" 2>/dev/null || true)
  if echo "$RESP" | json_ok; then
    pass "GET $EP"
  else
    fail "GET $EP"
  fi
done

# quality rule status patch (if any rules exist)
RULE_ID=$(curl -sf "$API/api/quality-rules" 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null || true)
if [ -n "$RULE_ID" ]; then
  CODE=$(http_code -X PATCH "$API/api/quality-rules/$RULE_ID/status" \
    -H "Content-Type: application/json" \
    -d '{"status":"Passed"}')
  [ "$CODE" = "200" ] && pass "PATCH /api/quality-rules/{id}/status" || fail "quality rule patch" "HTTP $CODE"
else
  skip "PATCH quality rule status" "no rules found"
fi

# ---------------------------------------------------------------------------
section "11. Export & knowledge base"
CODE=$(http_code "$API/api/export/collibra?format=csv")
[ "$CODE" = "200" ] && pass "GET /api/export/collibra?format=csv" || fail "Collibra CSV export" "HTTP $CODE"

RESP=$(curl -sf "$API/api/export/collibra?format=json" 2>/dev/null || true)
echo "$RESP" | json_ok && pass "GET /api/export/collibra?format=json" || fail "Collibra JSON export"

RESP=$(curl -sf "$API/api/knowledge-base/sections" 2>/dev/null || true)
if echo "$RESP" | json_ok && echo "$RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if len(d)>0 else 1)" 2>/dev/null; then
  pass "GET /api/knowledge-base/sections"
else
  fail "GET /api/knowledge-base/sections"
fi

# ---------------------------------------------------------------------------
section "12. Vector retrieval (optional — needs Ollama embeddings)"
if ollama_has_model "nomic-embed-text"; then
  RESP=$(curl -sf -m 120 -X POST "$API/api/analyze-metadata" \
    -H "Content-Type: application/json" \
    -d '{
      "fields": [{
        "database_name": "customer_db",
        "table_name": "customers",
        "column_name": "phone_number",
        "data_type": "string",
        "sample_values": ["555-0100"],
        "notes": "Contact phone"
      }],
      "no_llm": true,
      "persist": false,
      "retrieval_mode": "vector"
    }' 2>/dev/null || true)
  if echo "$RESP" | json_ok && echo "$RESP" | grep -q "phone_number"; then
    pass "POST /api/analyze-metadata (retrieval_mode=vector)"
  else
    fail "vector retrieval mode" "${RESP:0:120}"
  fi
else
  skip "vector retrieval mode" "nomic-embed-text not installed"
fi

# ---------------------------------------------------------------------------
section "13. LLM mode (optional — needs gemma4:e2b)"
if ollama_has_model "gemma4:e2b"; then
  RESP=$(curl -sf -m 180 -X POST "$API/api/analyze-metadata" \
    -H "Content-Type: application/json" \
    -d '{
      "fields": [{
        "database_name": "customer_db",
        "table_name": "customers",
        "column_name": "loyalty_tier",
        "data_type": "string",
        "sample_values": ["gold"],
        "notes": "Membership tier"
      }],
      "no_llm": false,
      "persist": false,
      "retrieval_mode": "tfidf",
      "model": "gemma4:e2b"
    }' 2>/dev/null || true)
  if echo "$RESP" | json_ok && echo "$RESP" | grep -q "loyalty_tier"; then
    pass "POST /api/analyze-metadata (no_llm=false, gemma4:e2b)"
  else
    fail "LLM analyze mode" "${RESP:0:120}"
  fi
else
  skip "LLM analyze mode" "gemma4:e2b not installed"
fi

# ---------------------------------------------------------------------------
echo
echo "========================================="
echo "Summary: PASS=$PASS  FAIL=$FAIL  SKIP=$SKIP"
echo "========================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
