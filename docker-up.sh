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
fi

docker compose --file "${COMPOSE_YML}" up "${COMPOSE_OPTIONS[@]}"
