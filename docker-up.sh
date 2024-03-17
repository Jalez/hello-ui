#!/bin/bash

SCRIPT_PATH=$(realpath "${BASH_SOURCE}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")

service="${1:-all}"

usage() {
  echo "Usage: ./docker-up.sh [ui|drawboard|all]"
  exit 1
}

start_ui() {
  pushd ${SCRIPT_DIR} &>/dev/null || exit 1
  docker build -t cssartist
  docker run -d -p 54322:3000 --name cssartist --restart always cssartist
  popd &>/dev/null
}

start_drawboard() {
  pushd ${SCRIPT_DIR}/drawBoard &>/dev/null || exit 1
  docker build -t draw ${SCRIPT_DIR}/drawBoard
  docker run -d -p 54320:3000 --name drawboard --restart always drawboard
  popd &>/dev/null
}

case "${service}" in
  ui|uidesigner|ui-designer|cssartist|css-artist)
    echo "Starting ui..."
    start_ui
    ;;
  board|draw|drawboard|drawBoard)
    echo "Starting drawboard..."
    start_drawboard
    ;;
  all)
    echo "Starting drawboard and ui..."
    start_drawboard
    start_ui
    ;;
  *)
    usage
    ;;
esac

