#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SERVER_ENTRYPOINT="${REPO_ROOT}/dist/bin-http.js"

HOST="${RIOTPLAN_HOST:-127.0.0.1}"
PORT="${RIOTPLAN_MCP_PORT:-3002}"
PLANS_DIR="${RIOTPLAN_PLANS_DIR:-${SCRIPT_DIR}/plans}"
CONTEXT_DIR="${RIOTPLAN_CONTEXT_DIR:-${SCRIPT_DIR}/context}"

if [[ ! -f "${SERVER_ENTRYPOINT}" ]]; then
  echo "Missing server entrypoint: ${SERVER_ENTRYPOINT}" >&2
  echo "Build riotplan-mcp-http first (from ${REPO_ROOT}): npm run build" >&2
  exit 1
fi

mkdir -p "${PLANS_DIR}" "${CONTEXT_DIR}"

echo "Starting local RiotPlan MCP HTTP server"
echo "Entrypoint: ${SERVER_ENTRYPOINT}"
echo "Plans dir: ${PLANS_DIR}"
echo "Context dir: ${CONTEXT_DIR}"
echo "URL: http://${HOST}:${PORT}"
echo "Health: http://${HOST}:${PORT}/health"

exec node "${SERVER_ENTRYPOINT}" \
  --port "${PORT}" \
  --plans-dir "${PLANS_DIR}" \
  --context-dir "${CONTEXT_DIR}" \
  "$@"
