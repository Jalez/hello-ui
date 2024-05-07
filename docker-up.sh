#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")

# docker-compose setup
COMPOSE_OPTIONS=("--build")
COMPOSE_YML="development.docker-compose.yml"

# set user id and group id
# these are used during the backend image building to set the user & group id
# to match the host system
# (this ensures that any mounted files will not become root owned)
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)

if [[ "$(hostname)" =~ tie-lukioplus.rd.tuni.fi ]]; then
  # set group id to "docker" group's id
  export HOST_GID=$(cut -d: -f3 < <(getent group docker))
  COMPOSE_YML="production.docker-compose.yml"
  COMPOSE_OPTIONS+=("-d")

  # server has a very old version of docker and docker-compose
  docker-compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
else
  docker compose --file ${COMPOSE_YML} up ${COMPOSE_OPTIONS[@]}
fi

