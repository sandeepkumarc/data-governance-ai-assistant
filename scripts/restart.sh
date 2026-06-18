#!/usr/bin/env bash
# Kill old AI-Assisted Data Governance processes and start backend (8000) + React UI (5173).
# Run from repo root: /Users/sandeepchintakunta/Documents/data-gov-ai-assistant
#
# Usage:
#   ./scripts/restart.sh              # kill ports + start both (background, logs)
#   ./scripts/restart.sh --docker-web-ui   # backend + UI via Docker
#   ./scripts/restart.sh --stop        # kill only
#   ./scripts/restart.sh --status      # show listeners on service ports
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib-runtime.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib-runtime.sh"
runtime_init "$ROOT"
BACKEND_PORT="${BACKEND_PORT:-8000}"
UI_PORT="${UI_PORT:-5173}"
LOG_DIR="${RUNTIME_LOG_DIR}"
PID_DIR="${RUNTIME_PID_DIR}"
PID_FILE="${RUNTIME_PID_FILE}"
VENV="${ROOT}/.venv"
USE_DOCKER_UI=false

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "  Stopping port ${port} (PID(s): ${pids//$'\n'/ })"
    # shellcheck disable=SC2086
    kill -9 ${pids} 2>/dev/null || true
    sleep 0.5
  fi
}

kill_saved_pids() {
  if [[ -f "${PID_FILE}" ]]; then
    while read -r pid _name; do
      [[ -n "${pid}" ]] || continue
      if kill -0 "${pid}" 2>/dev/null; then
        echo "  Stopping saved PID ${pid} (${_name})"
        kill -9 "${pid}" 2>/dev/null || true
      fi
    done < "${PID_FILE}"
    rm -f "${PID_FILE}"
  fi
  if [[ -d "${PID_DIR}" ]]; then
    for f in "${PID_DIR}"/*.pid; do
      [[ -f "$f" ]] || continue
      local pid
      pid="$(cat "$f" 2>/dev/null || true)"
      if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
        echo "  Stopping ${f} (PID ${pid})"
        kill -9 "${pid}" 2>/dev/null || true
      fi
      rm -f "$f"
    done
  fi
}

stop_services() {
  echo "==> Stopping AI-Assisted Data Governance processes..."
  kill_saved_pids
  kill_port "${BACKEND_PORT}"
  kill_port "${UI_PORT}"
  pkill -f "uvicorn main:app.*--port ${BACKEND_PORT}" 2>/dev/null || true
  pkill -f "${ROOT}/web-ui.*vite" 2>/dev/null || true
  (cd "${ROOT}" && docker compose -f docker-compose.web-ui.yml down 2>/dev/null) || true
  echo "==> Ports ${BACKEND_PORT} and ${UI_PORT} should be free."
}

show_status() {
  echo "==> Service port status (repo: ${ROOT})"
  for port in "${BACKEND_PORT}" "${UI_PORT}"; do
    if lsof -ti "tcp:${port}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "  Port ${port}: IN USE"
      lsof -nP -iTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
    else
      echo "  Port ${port}: free"
    fi
  done
}

start_services() {
  if [[ ! -d "${VENV}" ]]; then
    echo "ERROR: Missing ${VENV}. Create it first:"
    echo "  cd ${ROOT} && python3 -m venv .venv && source .venv/bin/activate"
    echo "  pip install -r backend/requirements.txt httpx"
    exit 1
  fi

  # shellcheck source=/dev/null
  source "${VENV}/bin/activate"
  pip install -q -r "${ROOT}/backend/requirements.txt" httpx

  mkdir -p "${LOG_DIR}" "${PID_DIR}"
  : > "${PID_FILE}"

  echo "==> Initializing SQLite (if needed)..."
  (cd "${ROOT}/backend" && python -c "from db.session import init_db; init_db()")

  echo "==> Starting API on http://127.0.0.1:${BACKEND_PORT} ..."
  (
    cd "${ROOT}/backend"
    nohup python -m uvicorn main:app --reload --host 127.0.0.1 --port "${BACKEND_PORT}" \
      >"${LOG_DIR}/backend.log" 2>&1 &
    echo $! backend >>"${PID_FILE}"
    echo $! >"${PID_DIR}/backend.pid"
  )

  echo "==> Waiting for API health..."
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
      echo "  API is up."
      break
    fi
    sleep 0.5
  done
  if ! curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    echo "WARN: API did not respond yet. Check ${LOG_DIR}/backend.log"
  fi

  if ${USE_DOCKER_UI}; then
    command -v docker >/dev/null || { echo "docker required for --docker-web-ui"; exit 1; }
    echo "==> Starting UI in Docker on http://127.0.0.1:${UI_PORT} ..."
    (
      cd "${ROOT}"
      nohup docker compose -f docker-compose.web-ui.yml up --build \
        >"${LOG_DIR}/ui.log" 2>&1 &
      echo $! docker-web-ui >>"${PID_FILE}"
    )
  else
    command -v npm >/dev/null || { echo "npm required (or use --docker-web-ui)"; exit 1; }
    if [[ ! -d "${ROOT}/web-ui/node_modules" ]]; then
      echo "==> Installing web-ui dependencies (first run)..."
      (cd "${ROOT}/web-ui" && npm install)
    fi
    echo "==> Starting UI on http://127.0.0.1:${UI_PORT} ..."
    (
      cd "${ROOT}/web-ui"
      export VITE_DEV_HOST=127.0.0.1
      export VITE_DEV_API_PROXY="http://127.0.0.1:${BACKEND_PORT}"
      nohup npm run dev >"${LOG_DIR}/ui.log" 2>&1 &
      echo $! web-ui >>"${PID_FILE}"
      echo $! >"${PID_DIR}/ui.pid"
    )
  fi

  sleep 2
  echo ""
  echo "=========================================="
  echo "  AI-Assisted Data Governance restarted"
  echo "  Repo:    ${ROOT}"
  echo "  UI:      http://127.0.0.1:${UI_PORT}"
  echo "  API:     http://127.0.0.1:${BACKEND_PORT}/api/health"
  echo "  Login:   steward@governance.local / steward"
  echo "  Logs:    ${LOG_DIR}/"
  echo "  Stop:    ./scripts/restart.sh --stop"
  echo "  Tail:    tail -f ${LOG_DIR}/backend.log ${LOG_DIR}/ui.log"
  echo "=========================================="
}

ACTION=start
for arg in "$@"; do
  case "$arg" in
    --docker-web-ui) USE_DOCKER_UI=true ;;
    --stop|-s|stop) ACTION=stop ;;
    --status) ACTION=status ;;
    --help|-h) ACTION=help ;;
    *)
      echo "Unknown option: $arg (try --help)"
      exit 1
      ;;
  esac
done

case "$ACTION" in
  stop) stop_services ;;
  status) show_status ;;
  help) sed -n '2,11p' "$0" ;;
  start)
    stop_services
    start_services
    ;;
esac
