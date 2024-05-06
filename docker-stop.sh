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


# service="${1:-all}"

# usage() {
#   echo "Usage: ./docker-stop.sh [ui|drawboard|all]"
#   exit 1
# }

# stop_ui() {
#   docker stop cssartist && docker container rm cssartist
# }

# stop_drawboard() {
#   docker stop drawboard && docker container rm drawboard
# }

# case "${service}" in
#   ui|uidesigner|ui-designer|cssartist|css-artist)
#     echo "Stopping ui..."
#     stop_ui
#     ;;
#   board|draw|drawboard|drawBoard)
#     echo "Stopping drawboard..."
#     stop_drawboard
#     ;;
#   all)
#     echo "Stopping ui and drawboard..."
#     stop_ui
#     stop_drawboard
#     ;;
#   *)
#     usage
#     ;;
# esac

