#!/bin/bash

# dev.sh - Start local development environment with hot-reload

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

# Function to clean up background processes on exit
cleanup() {
  echo ""
  echo "Shutting down services..."
  # Kill the background processes
  kill $WS_PID $DRAWBOARD_PID $APP_PID 2>/dev/null
  # Stop the database container
  docker compose stop db db-init
  exit
}

# Trap termination signals to ensure cleanup runs
trap cleanup SIGINT SIGTERM EXIT

echo "Starting database via docker-compose..."
docker compose up -d db db-init

echo "Starting ws-server in background..."
cd "${SCRIPT_DIR}/ws-server"
if [ ! -d "node_modules" ]; then
  echo "Installing ws-server dependencies..."
  npm install
fi
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
echo "Main App:   http://localhost:3000"
echo "Drawboard:  http://localhost:3500"
echo "WS Server:  http://localhost:3100"
echo "Press Ctrl+C to stop all services."
echo "==========================================================="

# Wait indefinitely so the script doesn't exit immediately 
# and the trap can catch Ctrl+C
wait
