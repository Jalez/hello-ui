#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")

# docker-compose setup
COMPOSE_OPTIONS=("--build")
COMPOSE_YML="development.docker-compose.yml"

export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

if [[ "$(hostname)" =~ tie-lukioplus.rd.tuni.fi ]]; then
  # set group id to "docker" group's id
  COMPOSE_YML="production.docker-compose.yml"
fi

docker compose --file ${COMPOSE_YML} down
