#!/usr/bin/env bash
# AI-Assisted Data Governance — one-command local start (Mac / Linux)
# Usage:
#   ./scripts/start.sh              # Python backend + native Node UI
#   ./scripts/start.sh --docker-web-ui  # Python backend + UI in Docker
#   ./scripts/start.sh --stop       # Stop background processes

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/.runtime-pids.txt"
BACKEND_PORT="${BACKEND_PORT:-8000}"
UI_PORT="${UI_PORT:-5173}"
USE_DOCKER_UI=false
ACTION=start

for arg in "$@"; do
  case "$arg" in
    --docker-web-ui) USE_DOCKER_UI=true ;;
    --stop) ACTION=stop ;;
    --help|-h)
      echo "Usage: $0 [--docker-web-ui] [--stop]"
      exit 0
      ;;
  esac
done

stop_services() {
  # Prefer hard port cleanup (same as restart.sh)
  if [[ -x "$ROOT/scripts/restart.sh" ]]; then
    "$ROOT/scripts/restart.sh" --stop
    return
  fi
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid name; do
      if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping $name (pid $pid)"
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  if $USE_DOCKER_UI; then
    (cd "$ROOT" && docker compose -f docker-compose.web-ui.yml down 2>/dev/null) || true
  fi
  echo "Services stopped."
}

if [[ "$ACTION" == "stop" ]]; then
  USE_DOCKER_UI=true
  stop_services
  exit 0
fi

command -v python3 >/dev/null || { echo "python3 required"; exit 1; }

stop_services
: > "$PID_FILE"

cd "$ROOT"

if [[ ! -d .venv ]]; then
  echo "Creating Python virtual environment..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r backend/requirements.txt httpx

echo "Initializing database..."
(cd backend && python -c "from db.session import init_db; init_db()")

echo "Starting backend on http://127.0.0.1:$BACKEND_PORT ..."
(
  cd backend
  exec python -m uvicorn main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload
) &
echo $! backend >> "$PID_FILE"
sleep 2

if curl -sf "http://127.0.0.1:$BACKEND_PORT/api/health" >/dev/null; then
  echo "Backend OK"
else
  echo "Warning: backend health check failed — UI may still work in offline mode"
fi

if $USE_DOCKER_UI; then
  command -v docker >/dev/null || { echo "docker required for --docker-web-ui"; exit 1; }
  echo "Starting UI in Docker on http://127.0.0.1:$UI_PORT ..."
  (cd "$ROOT" && docker compose -f docker-compose.web-ui.yml up --build) &
  echo $! docker-web-ui >> "$PID_FILE"
else
  command -v npm >/dev/null || { echo "npm required (or use --docker-web-ui)"; exit 1; }
  if [[ ! -d web-ui/node_modules ]]; then
    echo "Installing UI dependencies..."
    (cd web-ui && npm install)
  fi
  echo "Starting UI on http://127.0.0.1:$UI_PORT ..."
  (
    cd web-ui
    export VITE_DEV_HOST=127.0.0.1
    export VITE_DEV_API_PROXY="http://127.0.0.1:$BACKEND_PORT"
    exec npm run dev
  ) &
  echo $! web-ui >> "$PID_FILE"
fi

sleep 3

echo ""
echo "=============================================="
echo "  AI-Assisted Data Governance is running"
echo "  UI:      http://127.0.0.1:$UI_PORT"
echo "  API:     http://127.0.0.1:$BACKEND_PORT/api/health"
echo "  Login:   steward@governance.local / steward"
echo "  Tour:    Sidebar → Platform tour"
echo "  Stop:    ./scripts/start.sh --stop"
echo "=============================================="
echo ""

if command -v open >/dev/null; then
  open "http://127.0.0.1:$UI_PORT"
elif command -v xdg-open >/dev/null; then
  xdg-open "http://127.0.0.1:$UI_PORT"
fi

wait
