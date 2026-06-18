#!/usr/bin/env bash
# Kill old Vite/UI processes and start AI-Assisted Data Governance web-ui on 127.0.0.1:5173.
# Run from repo root: /Users/sandeepchintakunta/Documents/data-gov-ai-assistant
#
# Usage:
#   ./scripts/restart-ui.sh              # kill port 5173 + start native npm dev
#   ./scripts/restart-ui.sh --docker-web-ui    # kill + start UI via Docker
#   ./scripts/restart-ui.sh --stop         # kill UI only
#   ./scripts/restart-ui.sh --status       # check port 5173
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
UI_PID_FILE="${PID_DIR}/ui.pid"
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

kill_ui_pids() {
  if [[ -f "${UI_PID_FILE}" ]]; then
    local pid
    pid="$(cat "${UI_PID_FILE}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
      echo "  Stopping UI PID ${pid}"
      kill -9 "${pid}" 2>/dev/null || true
    fi
    rm -f "${UI_PID_FILE}"
  fi
  if [[ -f "${PID_FILE}" ]]; then
    local tmp="${PID_FILE}.tmp"
    : > "${tmp}"
    while read -r pid name; do
      [[ -n "${pid}" ]] || continue
      case "${name}" in
        web-ui|docker-web-ui)
          if kill -0 "${pid}" 2>/dev/null; then
            echo "  Stopping ${name} (PID ${pid})"
            kill -9 "${pid}" 2>/dev/null || true
          fi
          ;;
        *)
          echo "${pid} ${name}" >> "${tmp}"
          ;;
      esac
    done < "${PID_FILE}"
    mv "${tmp}" "${PID_FILE}"
  fi
}

stop_ui() {
  echo "==> Stopping AI-Assisted Data Governance UI..."
  kill_ui_pids
  kill_port "${UI_PORT}"
  pkill -f "${ROOT}/web-ui.*vite" 2>/dev/null || true
  (cd "${ROOT}" && docker compose -f docker-compose.web-ui.yml down 2>/dev/null) || true
  echo "==> Port ${UI_PORT} should be free."
}

show_status() {
  echo "==> UI status (repo: ${ROOT})"
  if lsof -ti "tcp:${UI_PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  Port ${UI_PORT}: IN USE"
    lsof -nP -iTCP:"${UI_PORT}" -sTCP:LISTEN 2>/dev/null || true
  else
    echo "  Port ${UI_PORT}: free"
  fi
  if [[ -f "${UI_PID_FILE}" ]]; then
    echo "  ui.pid: $(cat "${UI_PID_FILE}")"
  fi
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    echo "  Backend: up on port ${BACKEND_PORT}"
  else
    echo "  Backend: not reachable on port ${BACKEND_PORT} (start with ./scripts/restart.sh or run API separately)"
  fi
}

start_ui() {
  command -v npm >/dev/null || { echo "npm required (or use --docker-web-ui)"; exit 1; }
  mkdir -p "${LOG_DIR}" "${PID_DIR}"

  if ${USE_DOCKER_UI}; then
    command -v docker >/dev/null || { echo "docker required for --docker-web-ui"; exit 1; }
    echo "==> Starting UI in Docker on http://127.0.0.1:${UI_PORT} ..."
    (
      cd "${ROOT}"
      nohup docker compose -f docker-compose.web-ui.yml up --build \
        >"${LOG_DIR}/ui.log" 2>&1 &
      echo $! >"${UI_PID_FILE}"
      touch "${PID_FILE}"
      echo $! docker-web-ui >>"${PID_FILE}"
    )
  else
    if [[ ! -d "${ROOT}/web-ui/node_modules" ]]; then
      echo "==> Installing web-ui dependencies (first run)..."
      (cd "${ROOT}/web-ui" && npm install)
    fi
    echo "==> Starting Vite on http://127.0.0.1:${UI_PORT} ..."
    echo "    API proxy -> http://127.0.0.1:${BACKEND_PORT}"
    (
      cd "${ROOT}/web-ui"
      export VITE_DEV_HOST=127.0.0.1
      export VITE_DEV_API_PROXY="http://127.0.0.1:${BACKEND_PORT}"
      nohup npm run dev >"${LOG_DIR}/ui.log" 2>&1 &
      echo $! >"${UI_PID_FILE}"
      touch "${PID_FILE}"
      echo $! web-ui >>"${PID_FILE}"
    )
  fi

  sleep 2
  echo ""
  echo "=========================================="
  echo "  AI-Assisted Data Governance UI restarted"
  echo "  URL:     http://127.0.0.1:${UI_PORT}"
  echo "  Logs:    ${LOG_DIR}/ui.log"
  echo "  Stop:    ./scripts/restart-ui.sh --stop"
  echo "  Tail:    tail -f ${LOG_DIR}/ui.log"
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
  stop) stop_ui ;;
  status) show_status ;;
  help) sed -n '2,10p' "$0" ;;
  start)
    stop_ui
    start_ui
    ;;
esac
