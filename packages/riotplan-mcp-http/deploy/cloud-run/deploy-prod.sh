#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${PROJECT_ID:-discursive}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-riotplan-mcp}"
AR_REPO="${AR_REPO:-riotplan}"
IMAGE_NAME="${IMAGE_NAME:-riotplan-mcp}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-riotplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com}"
OPENAI_SECRET="${OPENAI_SECRET:-riotplan-openai-api-key}"
RIOTPLAN_MCP_HTTP_VERSION="${RIOTPLAN_MCP_HTTP_VERSION:-latest}"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/env.prod.yaml}"
STORAGE_ROLE="${STORAGE_ROLE:-roles/storage.objectAdmin}"
SKIP_STORAGE_IAM="${SKIP_STORAGE_IAM:-false}"
REQUEST_TIMEOUT="${REQUEST_TIMEOUT:-3600}"
MIN_INSTANCES="${MIN_INSTANCES:-1}"

if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing env file: ${ENV_FILE}"
    echo "Copy ${SCRIPT_DIR}/env.example.yaml to ${SCRIPT_DIR}/env.prod.yaml and edit values."
    exit 1
fi

extract_yaml_value() {
    local key="$1"
    local file="$2"
    sed -nE "s/^${key}:[[:space:]]*\"?([^\"#]+)\"?.*$/\1/p" "${file}" | sed -n '1p'
}

grant_bucket_access() {
    local bucket="$1"
    if [[ -z "${bucket}" ]]; then
        return 0
    fi
    echo "Ensuring ${SERVICE_ACCOUNT} has ${STORAGE_ROLE} on gs://${bucket}"
    gcloud storage buckets add-iam-policy-binding "gs://${bucket}" \
      --project="${PROJECT_ID}" \
      --member="serviceAccount:${SERVICE_ACCOUNT}" \
      --role="${STORAGE_ROLE}" \
      --quiet
}

echo "Deploying @planvokter/riotplan-mcp-http version: ${RIOTPLAN_MCP_HTTP_VERSION}"
echo "Project: ${PROJECT_ID}, Region: ${REGION}, Service: ${SERVICE_NAME}"
echo "Env file: ${ENV_FILE}"
echo "Cloud Run timeout: ${REQUEST_TIMEOUT}s, min instances: ${MIN_INSTANCES}, CPU: always allocated"

if [[ "${SKIP_STORAGE_IAM}" != "true" ]]; then
    PLAN_BUCKET="$(extract_yaml_value "RIOTPLAN_PLAN_BUCKET" "${ENV_FILE}")"
    CONTEXT_BUCKET="$(extract_yaml_value "RIOTPLAN_CONTEXT_BUCKET" "${ENV_FILE}")"

    declare -A BUCKETS=()
    [[ -n "${PLAN_BUCKET}" ]] && BUCKETS["${PLAN_BUCKET}"]=1
    [[ -n "${CONTEXT_BUCKET}" ]] && BUCKETS["${CONTEXT_BUCKET}"]=1

    if [[ ${#BUCKETS[@]} -gt 0 ]]; then
        echo "Applying Cloud Storage IAM for runtime access..."
        for BUCKET in "${!BUCKETS[@]}"; do
            grant_bucket_access "${BUCKET}"
        done
    else
        echo "No RIOTPLAN_*_BUCKET values found in ${ENV_FILE}; skipping IAM binding."
    fi
else
    echo "SKIP_STORAGE_IAM=true, skipping bucket IAM binding."
fi

gcloud builds submit "${SCRIPT_DIR}" \
  --project="${PROJECT_ID}" \
  --config="${SCRIPT_DIR}/cloudbuild.from-npm.yaml" \
  --substitutions="_REGION=${REGION},_SERVICE_NAME=${SERVICE_NAME},_AR_REPO=${AR_REPO},_IMAGE_NAME=${IMAGE_NAME},_SERVICE_ACCOUNT=${SERVICE_ACCOUNT},_ENV_VARS_FILE=$(basename "${ENV_FILE}"),_OPENAI_SECRET=${OPENAI_SECRET},_RIOTPLAN_MCP_HTTP_VERSION=${RIOTPLAN_MCP_HTTP_VERSION},_REQUEST_TIMEOUT=${REQUEST_TIMEOUT},_MIN_INSTANCES=${MIN_INSTANCES}"
