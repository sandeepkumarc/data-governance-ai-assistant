# Shared paths and migration for service start/restart scripts.
# shellcheck shell=bash
runtime_init() {
  local root="$1"
  RUNTIME_LOG_DIR="${root}/.runtime-logs"
  RUNTIME_PID_DIR="${root}/.runtime/pids"
  RUNTIME_PID_FILE="${root}/.runtime-pids.txt"

  # Legacy pid file from older installs (migrate to .runtime-pids.txt).
  if [[ -f "${root}/.demo-pids" && ! -f "${RUNTIME_PID_FILE}" ]]; then
    mv "${root}/.demo-pids" "${RUNTIME_PID_FILE}"
  elif [[ -f "${root}/.demo-pids" ]]; then
    rm -f "${root}/.demo-pids"
  fi
  if [[ -d "${root}/.demo-pids" ]]; then
    rm -rf "${root}/.demo-pids"
  fi

  mkdir -p "${RUNTIME_LOG_DIR}" "${RUNTIME_PID_DIR}"
}
