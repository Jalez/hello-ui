#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="production.docker-compose.yml"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
EXPORT_DIR="exported-logs/prod-${TIMESTAMP}"
DEBUG_LOG_DIR="${EXPORT_DIR}/app-debug-logs"
ARCHIVE_PATH="${EXPORT_DIR}.tar.gz"
SERVICES=(app ws-server db drawboard)

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing ${COMPOSE_FILE} in ${ROOT_DIR}" >&2
  exit 1
fi

mkdir -p "${EXPORT_DIR}" "${DEBUG_LOG_DIR}"

{
  echo "timestamp=${TIMESTAMP}"
  echo "hostname=$(hostname)"
  echo "pwd=${ROOT_DIR}"
  echo "compose_file=${COMPOSE_FILE}"
} > "${EXPORT_DIR}/metadata.txt"

docker compose --env-file .env.production -f "${COMPOSE_FILE}" ps > "${EXPORT_DIR}/compose-ps.txt" 2>&1 || true
docker ps -a > "${EXPORT_DIR}/docker-ps.txt" 2>&1 || true

for service in "${SERVICES[@]}"; do
  docker compose --env-file .env.production -f "${COMPOSE_FILE}" logs --no-color "${service}" > "${EXPORT_DIR}/${service}.log" 2>&1 || true
done

docker compose --env-file .env.production -f "${COMPOSE_FILE}" logs --no-color > "${EXPORT_DIR}/all-services.log" 2>&1 || true

if compgen -G "logs/debug-*.jsonl" > /dev/null; then
  cp logs/debug-*.jsonl "${DEBUG_LOG_DIR}/"
fi

tar -czf "${ARCHIVE_PATH}" -C "exported-logs" "$(basename "${EXPORT_DIR}")"

echo "Exported logs to ${EXPORT_DIR}"
echo "Created archive ${ARCHIVE_PATH}"
