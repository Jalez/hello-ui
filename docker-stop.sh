#!/bin/bash

set -euo pipefail

SCRIPT_PATH=$(realpath "${BASH_SOURCE[0]}")
SCRIPT_DIR=$(dirname "${SCRIPT_PATH}")
cd "${SCRIPT_DIR}"

HOSTNAME_FQDN="$(hostname -f 2>/dev/null || hostname)"

APP_ENV="${APP_ENV:-}"
if [[ -z "${APP_ENV}" ]]; then
  if [[ "${HOSTNAME_FQDN}" =~ itc-games\.rd\.tuni\.fi|tie-lukioplus\.rd\.tuni\.fi ]]; then
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

if [[ "${APP_ENV}" == "production" ]]; then
  COMPOSE_FILE="production.docker-compose.yml"
  if [[ -f ".env.production" ]]; then
    ENV_ARGS=(--env-file .env.production)
  fi
fi

exec "${CONTAINER_RUNTIME}" compose "${ENV_ARGS[@]}" --file "${COMPOSE_FILE}" down
