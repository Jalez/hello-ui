#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

# docker-compose setup
COMPOSE_OPTIONS=("--build")
COMPOSE_YML="docker-compose.yml"

if [[ "$(hostname)" =~ tie-lukioplus.rd.tuni.fi ]]; then
  set -e
  COMPOSE_YML="production.docker-compose.yml"
  COMPOSE_OPTIONS+=("-d")

  # server has very old docker (1.13) and docker-compose (1.18)
  # - docker-compose crashes on Unicode build output, so build images with docker directly
  # - docker-compose strips hyphens from project name for network names

  # 0. Stop any running containers for a clean start
  docker-compose --file ${COMPOSE_YML} down

  # 1. Build all images first (bypasses docker-compose Unicode crash)
  echo "Building images..."
  # NEXT_PUBLIC_* is baked in at build; .env.production at runtime does not change the client bundle.
  # If unset, try .env.production next to this script (same line as docker-compose env_file).
  if [[ -z "${NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE:-}" ]] && [[ -f .env.production ]]; then
    NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE="$(
      grep -E '^[[:space:]]*NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE=' .env.production 2>/dev/null | tail -1 \
        | sed -E 's/^[[:space:]]*NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE=//; s/\r$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//'
    )"
  fi
  NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE="${NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE:-playwright}"
  echo "NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE for app image build: ${NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE}"
  if [[ -z "${NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS:-}" ]] && [[ -f .env.production ]]; then
    NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS="$(
      grep -E '^[[:space:]]*NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS=' .env.production 2>/dev/null | tail -1 \
        | sed -E 's/^[[:space:]]*NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS=//; s/\r$//; s/^"//; s/"$//; s/^'\''//; s/'\''$//'
    )"
  fi
  NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS="${NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS:-0}"
  echo "NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS for app image build: ${NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS}"
  docker build -t ui-designer-app:latest \
    --build-arg NEXT_PUBLIC_APP_URL=https://tie-lukioplus.rd.tuni.fi/css-artist \
    --build-arg NEXT_PUBLIC_DRAWBOARD_URL=https://tie-lukioplus.rd.tuni.fi/drawboard \
    --build-arg NEXT_PUBLIC_WEBSOCKET_URL=wss://tie-lukioplus.rd.tuni.fi/css-artist-ws \
    --build-arg NEXT_PUBLIC_ASSET_PREFIX=/css-artist \
    --build-arg NEXT_PUBLIC_BASE_PATH=/css-artist \
    --build-arg NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE="${NEXT_PUBLIC_DRAWBOARD_CAPTURE_MODE}" \
    --build-arg NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS="${NEXT_PUBLIC_REMOTE_SYNC_DEBOUNCE_MS}" \
    -f Dockerfile .
  docker build -t ui-designer-ws:latest -f ws-server/Dockerfile ./ws-server
  docker build -t ui-designer-drawboard:latest -f drawBoard/Dockerfile ./drawBoard
  docker build -t ui-designer-db-init -f Dockerfile.db-init .
  echo "Images built."

  # 2. Start the database
  docker-compose --file ${COMPOSE_YML} up -d db
  echo "Waiting for database to be ready..."
  WAIT_MAX=90
  WAIT_SEC=0
  while ! docker exec ui-designer.db pg_isready -U postgres -d ui_designer > /dev/null 2>&1; do
    sleep 2
    WAIT_SEC=$((WAIT_SEC + 2))
    if [ "$((WAIT_SEC % 10))" -eq 0 ] && [ "$WAIT_SEC" -gt 0 ]; then
      echo "  ... still waiting (${WAIT_SEC}s)"
    fi
    if [ "$WAIT_SEC" -ge "$WAIT_MAX" ]; then
      echo "ERROR: Database did not become ready within ${WAIT_MAX}s. Check: docker ps -a; docker logs ui-designer.db"
      exit 1
    fi
  done
  echo "Database is ready."

  # 3. Run migrations — find the compose network dynamically
  echo "Running database migrations..."
  NETWORK_NAME=$(docker network ls | grep ui-designer-net | awk '{print $2}')
  docker run --rm --network "${NETWORK_NAME}" \
    -e DATABASE_URL=postgresql://postgres:postgres@db:5432/ui_designer \
    ui-designer-db-init
  echo "Migrations complete."

  # 3.5 Apply latest Drizzle schema changes so newly added tables/columns exist
  echo "Running Drizzle schema push..."
  docker run --rm --network "${NETWORK_NAME}" \
    -e DATABASE_URL=postgresql://postgres:postgres@db:5432/ui_designer \
    -e DB_CLIENT=postgres \
    ui-designer-app:latest \
    bash -lc "cd /app && pnpm db:push"
  echo "Drizzle schema push complete."

  # 4. Bring up all services (images already built, no --build needed)
  docker-compose --file ${COMPOSE_YML} up -d
else
  docker compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
fi
