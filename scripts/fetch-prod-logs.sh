#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

REMOTE_USER="${REMOTE_USER:-a642905}"
REMOTE_HOST="${REMOTE_HOST:-tie-lukioplus.rd.tuni.fi}"
REMOTE_REPO_DIR="${REMOTE_REPO_DIR:-/plussa/grader/courses/css-artist}"
REMOTE_EXPORT_GLOB="${REMOTE_EXPORT_GLOB:-${REMOTE_REPO_DIR}/exported-logs/prod-*.tar.gz}"
LOCAL_ARCHIVE_DIR="${LOCAL_ARCHIVE_DIR:-${ROOT_DIR}}"
LOCAL_EXTRACT_DIR="${LOCAL_EXTRACT_DIR:-${ROOT_DIR}/exported-logs}"

mkdir -p "${LOCAL_ARCHIVE_DIR}" "${LOCAL_EXTRACT_DIR}"

REMOTE_ARCHIVE="${1:-}"

if [[ -z "${REMOTE_ARCHIVE}" ]]; then
  REMOTE_ARCHIVE="$(ssh "${REMOTE_USER}@${REMOTE_HOST}" "ls -1t ${REMOTE_EXPORT_GLOB} 2>/dev/null | head -n 1")"
fi

if [[ -z "${REMOTE_ARCHIVE}" ]]; then
  echo "No remote prod log archive found matching ${REMOTE_EXPORT_GLOB}" >&2
  exit 1
fi

ARCHIVE_NAME="$(basename "${REMOTE_ARCHIVE}")"
LOCAL_ARCHIVE_PATH="${LOCAL_ARCHIVE_DIR}/${ARCHIVE_NAME}"

scp "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_ARCHIVE}" "${LOCAL_ARCHIVE_PATH}"
tar -xzf "${LOCAL_ARCHIVE_PATH}" -C "${LOCAL_EXTRACT_DIR}"

EXTRACTED_DIR_NAME="$(tar -tzf "${LOCAL_ARCHIVE_PATH}" | head -n 1 | cut -d/ -f1)"

echo "Fetched archive: ${LOCAL_ARCHIVE_PATH}"
echo "Extracted logs to: ${LOCAL_EXTRACT_DIR}/${EXTRACTED_DIR_NAME}"
