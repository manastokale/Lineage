#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_PYTHON="$ROOT_DIR/.venv311/bin/python"
FRONTEND_SERVER="$ROOT_DIR/scripts/serve_frontend.py"
EPISODE_LIBRARY_BUILDER="$ROOT_DIR/scripts/build_episode_library.py"
BACKEND_REQUIREMENTS="$ROOT_DIR/backend/requirements.txt"
BACKEND_PORT=8000
FRONTEND_PORT=5173

usage() {
  cat <<'EOF'
Usage:
  ./scripts/friendsos.sh start <local|lan> <dev|prod>
  ./scripts/friendsos.sh stop  <local|lan> <dev|prod>
  ./scripts/friendsos.sh build <local|lan> <dev|prod>
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

detect_lan_ip() {
  local ip=""
  for iface in en0 en1; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return 0
    fi
  done
  ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" { print $2; exit }')"
  [[ -n "$ip" ]] && echo "$ip"
}

wait_for_url() {
  local url="$1"
  local seconds="${2:-45}"
  local i=0
  while (( i < seconds )); do
    if curl --max-time 2 -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    ((i+=1))
  done
  return 1
}

kill_port_users() {
  local port="$1"
  local pids=""
  pids="$(lsof -tiTCP:"$port" 2>/dev/null | sort -u || true)"
  [[ -z "$pids" ]] && return 0
  while IFS= read -r pid; do
    [[ -n "$pid" ]] && kill "$pid" >/dev/null 2>&1 || true
  done <<< "$pids"
  sleep 1
  while IFS= read -r pid; do
    [[ -n "$pid" ]] || continue
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  done <<< "$pids"
}

launch_detached() {
  local command_string="$1"
  local log_file="$2"
  local pid_file="$3"

  if command -v setsid >/dev/null 2>&1; then
    nohup setsid bash -lc "$command_string" >"$log_file" 2>&1 </dev/null &
  else
    nohup bash -lc "$command_string" >"$log_file" 2>&1 </dev/null &
  fi
  echo $! > "$pid_file"
}

stop_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    kill "$(cat "$pid_file")" >/dev/null 2>&1 || true
    rm -f "$pid_file"
  fi
}

if [[ $# -ne 3 ]]; then
  usage
  exit 1
fi

ACTION="$1"
SCOPE="$2"
MODE="$3"

case "$ACTION" in
  start|stop|build) ;;
  *) usage; fail "Unsupported action '$ACTION'" ;;
esac

case "$SCOPE" in
  local|lan) ;;
  *) usage; fail "Unsupported scope '$SCOPE'" ;;
esac

case "$MODE" in
  dev|prod) ;;
  *) usage; fail "Unsupported mode '$MODE'" ;;
esac

if [[ "$MODE" == "dev" ]]; then
  APP_ENV_VALUE="development"
else
  APP_ENV_VALUE="production"
fi

mkdir -p "$RUN_DIR"

STACK_ID="$SCOPE.$MODE"
BACKEND_LOG="$RUN_DIR/backend.$STACK_ID.log"
FRONTEND_LOG="$RUN_DIR/frontend.$STACK_ID.log"
BACKEND_PID_FILE="$RUN_DIR/backend.$STACK_ID.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.$STACK_ID.pid"

if [[ "$SCOPE" == "local" ]]; then
  BACKEND_BIND_HOST="127.0.0.1"
  FRONTEND_BIND_HOST="127.0.0.1"
  PUBLIC_HOST="127.0.0.1"
else
  BACKEND_BIND_HOST="0.0.0.0"
  FRONTEND_BIND_HOST="0.0.0.0"
  PUBLIC_HOST="$(detect_lan_ip)" || fail "Unable to detect LAN IP."
fi

BACKEND_URL="http://$PUBLIC_HOST:$BACKEND_PORT"
FRONTEND_URL="http://$PUBLIC_HOST:$FRONTEND_PORT"

if [[ "$SCOPE" == "lan" ]]; then
  CORS_ORIGINS="$FRONTEND_URL,http://127.0.0.1:$FRONTEND_PORT,http://localhost:$FRONTEND_PORT"
else
  CORS_ORIGINS="$FRONTEND_URL,http://localhost:$FRONTEND_PORT"
fi

if [[ "$ACTION" == "stop" ]]; then
  echo "Stopping Lineage $STACK_ID..."
  stop_pid_file "$BACKEND_PID_FILE"
  stop_pid_file "$FRONTEND_PID_FILE"
  kill_port_users "$BACKEND_PORT"
  kill_port_users "$FRONTEND_PORT"
  echo "Lineage $STACK_ID stopped."
  exit 0
fi

[[ -x "$VENV_PYTHON" ]] || fail "Missing backend venv interpreter at $VENV_PYTHON"
[[ -f "$FRONTEND_SERVER" ]] || fail "Missing frontend server helper at $FRONTEND_SERVER"
[[ -f "$EPISODE_LIBRARY_BUILDER" ]] || fail "Missing episode library builder at $EPISODE_LIBRARY_BUILDER"
[[ -f "$BACKEND_REQUIREMENTS" ]] || fail "Missing backend requirements at $BACKEND_REQUIREMENTS"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  (
    cd "$FRONTEND_DIR"
    npm install
  ) >"$RUN_DIR/frontend.install.log" 2>&1
fi

if ! "$VENV_PYTHON" -c "import fastapi, chromadb" >/dev/null 2>&1; then
  echo "Installing backend dependencies..."
  (
    cd "$ROOT_DIR"
    "$VENV_PYTHON" -m pip install -r "$BACKEND_REQUIREMENTS"
  ) >"$RUN_DIR/backend.install.log" 2>&1
fi

echo "Building parsed transcript library..."
(
  cd "$ROOT_DIR"
  "$VENV_PYTHON" "$EPISODE_LIBRARY_BUILDER"
) >"$RUN_DIR/episode-library.$STACK_ID.log" 2>&1

echo "Building frontend..."
(
  cd "$FRONTEND_DIR"
  npm run build
) >"$FRONTEND_LOG" 2>&1

if [[ "$ACTION" == "build" ]]; then
  echo "Build complete."
  echo "Frontend build log: $FRONTEND_LOG"
  exit 0
fi

stop_pid_file "$BACKEND_PID_FILE"
stop_pid_file "$FRONTEND_PID_FILE"
kill_port_users "$BACKEND_PORT"
kill_port_users "$FRONTEND_PORT"

echo "Starting Lineage $STACK_ID..."
echo "Repo:     $ROOT_DIR"
echo "Backend:  $BACKEND_DIR"
echo "Frontend: $FRONTEND_DIR"

echo "Starting backend..."
launch_detached "cd '$BACKEND_DIR' && APP_ENV='$APP_ENV_VALUE' CORS_ALLOWED_ORIGINS='$CORS_ORIGINS' LINEAGE_MEMORY_BACKEND=chroma '$VENV_PYTHON' -u -m uvicorn main:app --host $BACKEND_BIND_HOST --port $BACKEND_PORT" "$BACKEND_LOG" "$BACKEND_PID_FILE"

if ! wait_for_url "http://127.0.0.1:$BACKEND_PORT/api/health" 45; then
  echo "Backend failed to bind to port $BACKEND_PORT."
  echo "Check log: $BACKEND_LOG"
  exit 1
fi

echo "Starting frontend..."
launch_detached "cd '$ROOT_DIR' && '$VENV_PYTHON' '$FRONTEND_SERVER' --host $FRONTEND_BIND_HOST --port $FRONTEND_PORT --root '$FRONTEND_DIR/dist'" "$FRONTEND_LOG" "$FRONTEND_PID_FILE"

if ! wait_for_url "http://127.0.0.1:$FRONTEND_PORT" 30; then
  echo "Frontend failed to bind to port $FRONTEND_PORT."
  echo "Check log: $FRONTEND_LOG"
  exit 1
fi

echo
echo "Lineage $STACK_ID is up."
echo "Frontend: $FRONTEND_URL"
echo "Backend:  $BACKEND_URL"
echo "Health:   $BACKEND_URL/api/health"
echo "Logs:"
echo "  Backend:  $BACKEND_LOG"
echo "  Frontend: $FRONTEND_LOG"
