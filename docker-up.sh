#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

APP_ENV="${APP_ENV:-}"
if [[ -z "${APP_ENV}" ]]; then
  if [[ -f ".env.local" ]]; then
    APP_ENV="local"
  elif [[ -f ".env.production" ]]; then
    APP_ENV="production"
  else
    APP_ENV="local"
  fi
fi

CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-}"
if [[ -z "${CONTAINER_RUNTIME}" ]]; then
  if [[ "${APP_ENV}" == "production" ]] && command -v podman >/dev/null 2>&1; then
    CONTAINER_RUNTIME="podman"
  elif command -v docker >/dev/null 2>&1; then
    CONTAINER_RUNTIME="docker"
  elif command -v podman >/dev/null 2>&1; then
    CONTAINER_RUNTIME="podman"
  else
    echo "No supported container runtime found. Install docker or podman." >&2
    exit 1
  fi
fi

COMPOSE_FILE="docker-compose.yml"
ENV_ARGS=()
UP_ARGS=(up --build)

if [[ "${APP_ENV}" == "production" ]]; then
  COMPOSE_FILE="production.docker-compose.yml"
  UP_ARGS+=(-d)
  if [[ -f ".env.production" ]]; then
    ENV_ARGS=(--env-file .env.production)
  fi
fi

COMPOSE_CMD=("${CONTAINER_RUNTIME}" compose)
if (( ${#ENV_ARGS[@]} > 0 )); then
  COMPOSE_CMD+=("${ENV_ARGS[@]}")
fi
COMPOSE_CMD+=(--file "${COMPOSE_FILE}" "${UP_ARGS[@]}")

exec "${COMPOSE_CMD[@]}"
