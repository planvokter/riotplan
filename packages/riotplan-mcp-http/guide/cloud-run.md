# Cloud Run Deployment Template

This template deploys RiotPlan MCP HTTP (`@planvokter/riotplan-mcp-http`) to Google Cloud Run using Cloud Build.

Use these files:

- `deploy/cloud-run/Dockerfile`
- `deploy/cloud-run/cloudbuild.yaml`
- `deploy/cloud-run/env.example.yaml`
- `deploy/cloud-run/Dockerfile.from-npm`
- `deploy/cloud-run/cloudbuild.from-npm.yaml`
- `deploy/cloud-run/deploy-prod.sh`
- `deploy/cloud-run/rbac-users.example.yaml`
- `deploy/cloud-run/rbac-keys.example.yaml`
- `deploy/cloud-run/rbac-policy.example.yaml`

For local testing, use:

- `deploy/local/riotplan-local.sh`
- `deploy/local/README.md`

## 1) Runtime Service Account

Create a dedicated runtime service account for Cloud Run:

```bash
gcloud iam service-accounts create riotplan-runtime \
  --display-name="RiotPlan Cloud Run Runtime"
```

Grant only required permissions. For GCS cloud mode, start with:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:riotplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Allow deploy identities to use the runtime service account:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"

gcloud iam service-accounts add-iam-policy-binding "riotplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="user:${USER_EMAIL}" \
  --role="roles/iam.serviceAccountUser"

gcloud iam service-accounts add-iam-policy-binding "riotplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

## 2) Required APIs + IAM

Enable required services:

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com
```

Minimum project roles for deploy user (`USER_EMAIL`):

- `roles/cloudbuild.builds.editor`
- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/storage.admin`

Minimum project roles for Cloud Build service account (`${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com`):

- `roles/run.admin`
- `roles/artifactregistry.writer`

## 3) Artifact Registry (one-time)

Create a Docker repository for images:

```bash
gcloud artifacts repositories create riotplan \
  --repository-format=docker \
  --location=us-central1 \
  --description="RiotPlan images"
```

## 4) Secrets

Create OpenAI secret:

```bash
printf '%s' "$OPENAI_API_KEY" | gcloud secrets create riotplan-openai-api-key \
  --project="$PROJECT_ID" \
  --replication-policy=automatic \
  --data-file=- || \
printf '%s' "$OPENAI_API_KEY" | gcloud secrets versions add riotplan-openai-api-key \
  --project="$PROJECT_ID" \
  --data-file=-
```

Grant runtime service account access:

```bash
gcloud secrets add-iam-policy-binding riotplan-openai-api-key \
  --project="$PROJECT_ID" \
  --member="serviceAccount:riotplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## 5) Environment Variables (non-secret)

Copy and edit env vars:

```bash
cp deploy/cloud-run/env.example.yaml deploy/cloud-run/env.prod.yaml
```

Update `deploy/cloud-run/env.prod.yaml` with non-secret values only.

For secured RBAC mode, set:

- `RIOTPLAN_HTTP_SECURED: "true"`
- `RBAC_USERS_PATH`, `RBAC_KEYS_PATH`
- optional `RBAC_POLICY_PATH`, `RBAC_RELOAD_SECONDS`

## 5b) Mount RBAC files into Cloud Run

RBAC is file-backed. Mount users/keys (and optional policy) into the container filesystem.

Recommended source: Secret Manager secrets mounted as files.

Example deploy flags:

```bash
--add-volume=name=rbac-users,secret=riotplan-rbac-users \
--add-volume=name=rbac-keys,secret=riotplan-rbac-keys \
--add-volume=name=rbac-policy,secret=riotplan-rbac-policy \
--add-volume-mount=volume=rbac-users,mount-path=/var/run/riotplan-rbac/users,read-only \
--add-volume-mount=volume=rbac-keys,mount-path=/var/run/riotplan-rbac/keys,read-only \
--add-volume-mount=volume=rbac-policy,mount-path=/var/run/riotplan-rbac/policy,read-only
```

Then point env vars at mounted files, for example:

- `RBAC_USERS_PATH=/var/run/riotplan-rbac/users/users.yaml`
- `RBAC_KEYS_PATH=/var/run/riotplan-rbac/keys/keys.yaml`
- `RBAC_POLICY_PATH=/var/run/riotplan-rbac/policy/policy.yaml`

## 6) Configure Cloud Build Substitutions

`deploy/cloud-run/cloudbuild.yaml` uses:

- `_REGION`
- `_SERVICE_NAME`
- `_AR_REPO`
- `_IMAGE_NAME`
- `_SERVICE_ACCOUNT`
- `_ENV_VARS_FILE`
- `_OPENAI_SECRET`
- `_REQUEST_TIMEOUT` (seconds; default `3600` for MCP SSE streams)
- `_MIN_INSTANCES` (default `1` to reduce cold starts)

For production, set `_ENV_VARS_FILE=deploy/cloud-run/env.prod.yaml`.

## 7) Deploy

From repo root:

```bash
gcloud builds submit --config deploy/cloud-run/cloudbuild.yaml \
  --substitutions=_REGION=us-central1,_SERVICE_NAME=riotplan-mcp,_AR_REPO=riotplan,_IMAGE_NAME=riotplan-mcp,_SERVICE_ACCOUNT=riotplan-runtime@${PROJECT_ID}.iam.gserviceaccount.com,_ENV_VARS_FILE=deploy/cloud-run/env.prod.yaml,_OPENAI_SECRET=riotplan-openai-api-key,_REQUEST_TIMEOUT=3600,_MIN_INSTANCES=1
```

If secured RBAC mode is enabled, ensure RBAC files are mounted before first traffic. The server fails fast on startup if RBAC files are missing/invalid.

## Ops-style deploy (from npm package)

```bash
cp deploy/cloud-run/env.example.yaml deploy/cloud-run/env.prod.yaml
# edit deploy/cloud-run/env.prod.yaml
./deploy/cloud-run/deploy-prod.sh
```

Optional package pin:

```bash
RIOTPLAN_MCP_HTTP_VERSION=1.0.26 ./deploy/cloud-run/deploy-prod.sh
```

## Local testing

```bash
npm run build
./deploy/local/riotplan-local.sh
```

You can continue local HTTP MCP testing while using Cloud Run for shared/remote environments.
