#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

# docker-compose setup
COMPOSE_YML="docker-compose.yml"

if [[ "$(hostname)" =~ tie-lukioplus.rd.tuni.fi ]]; then
  COMPOSE_YML="production.docker-compose.yml"
fi

if [[ "${COMPOSE_YML}" == "production.docker-compose.yml" && -f ".env.production" ]]; then
  docker compose --env-file .env.production --file "${COMPOSE_YML}" down
else
  docker compose --file "${COMPOSE_YML}" down
fi
