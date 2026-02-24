#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

# docker-compose setup
COMPOSE_OPTIONS=("--build")
COMPOSE_YML="docker-compose.yml"

if [[ "$(hostname)" =~ tie-lukioplus.rd.tuni.fi ]]; then
  COMPOSE_YML="production.docker-compose.yml"
  COMPOSE_OPTIONS+=("-d")

  # server has a very old version of docker and docker-compose

  # 1. Start the database first
  docker-compose --file ${COMPOSE_YML} up -d --build db
  echo "Waiting for database to be ready..."
  until docker exec ui-designer.db pg_isready -U postgres -d ui_designer > /dev/null 2>&1; do
    sleep 2
  done
  echo "Database is ready."

  # 2. Run migrations via the db-init container
  echo "Running database migrations..."
  docker build -t ui-designer-db-init -f Dockerfile.db-init .
  # Network name is <project>_<network>; project = directory name
  NETWORK_NAME="$(basename "${SCRIPT_DIR}")_ui-designer-net"
  docker run --rm --network "${NETWORK_NAME}" \
    -e DATABASE_URL=postgresql://postgres:postgres@db:5432/ui_designer \
    ui-designer-db-init
  echo "Migrations complete."

  # 3. Bring up all services
  docker-compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
else
  docker compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
fi
