#!/bin/bash

# dev.sh - Start local development environment with hot-reload

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

export WS_SERVICE_TOKEN="${WS_SERVICE_TOKEN:-ws-service-secret}"
export COLLAB_ENGINE="${COLLAB_ENGINE:-${NEXT_PUBLIC_COLLAB_ENGINE:-yjs}}"
export NEXT_PUBLIC_COLLAB_ENGINE="${NEXT_PUBLIC_COLLAB_ENGINE:-${COLLAB_ENGINE}}"
export WS_ARTIFICIAL_DELAY_MS="${WS_ARTIFICIAL_DELAY_MS:-80}"
export WS_ARTIFICIAL_JITTER_MS="${WS_ARTIFICIAL_JITTER_MS:-120}"
APP_PORT="${APP_PORT:-3000}"
WS_PORT="${WS_PORT:-3100}"
DRAWBOARD_PORT="${DRAWBOARD_PORT:-3500}"

# Kill any existing listeners on the ports this script needs.
free_port() {
  local port="$1"
  local pids

  pids=$(lsof -ti tcp:"${port}" 2>/dev/null)
  if [ -z "${pids}" ]; then
    return
  fi

  echo "Closing existing process(es) on port ${port}: ${pids}"
  kill ${pids} 2>/dev/null || true
  sleep 1

  pids=$(lsof -ti tcp:"${port}" 2>/dev/null)
  if [ -n "${pids}" ]; then
    echo "Force killing stubborn process(es) on port ${port}: ${pids}"
    kill -9 ${pids} 2>/dev/null || true
  fi
}

close_required_ports() {
  free_port "${APP_PORT}"
  free_port "${WS_PORT}"
  free_port "${DRAWBOARD_PORT}"
}

# Function to clean up background processes on exit
cleanup() {
  echo ""
  echo "Shutting down services..."
  # Kill the background processes
  kill "${WS_PID:-}" "${DRAWBOARD_PID:-}" "${APP_PID:-}" 2>/dev/null || true
  # Stop the database container
  docker compose stop db db-init
  exit
}

# Trap termination signals to ensure cleanup runs
trap cleanup SIGINT SIGTERM EXIT

echo "Closing any existing dev processes on ports ${APP_PORT}, ${WS_PORT}, ${DRAWBOARD_PORT}..."
close_required_ports

echo "Starting database via docker-compose..."
docker compose up -d db db-init

echo "Starting ws-server in background..."
cd "${SCRIPT_DIR}/ws-server"
if [ ! -d "node_modules" ]; then
  echo "Installing ws-server dependencies..."
  npm install
fi
echo "WS latency simulation: base=${WS_ARTIFICIAL_DELAY_MS}ms jitter=${WS_ARTIFICIAL_JITTER_MS}ms"
npm run dev &
WS_PID=$!

echo "Starting drawboard in background..."
cd "${SCRIPT_DIR}/drawBoard"
if [ ! -d "node_modules" ]; then
  echo "Installing drawboard dependencies..."
  npm install
fi
npm run dev &
DRAWBOARD_PID=$!

echo "Starting main app in background..."
cd "${SCRIPT_DIR}"
if [ ! -d "node_modules" ]; then
  echo "Installing main app dependencies..."
  pnpm install
fi
npm run dev &
APP_PID=$!

echo "==========================================================="
echo "All local dev services started!"
echo "Main App:   http://localhost:${APP_PORT}"
echo "Drawboard:  http://localhost:${DRAWBOARD_PORT}"
echo "WS Server:  http://localhost:${WS_PORT}"
echo "Press Ctrl+C to stop all services."
echo "==========================================================="

# Wait indefinitely so the script doesn't exit immediately 
# and the trap can catch Ctrl+C
wait
