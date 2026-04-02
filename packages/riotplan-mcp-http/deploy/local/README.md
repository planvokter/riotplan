# Local HTTP MCP Run

Run RiotPlan HTTP MCP locally with a persistent test directory layout.

## Prerequisites

From repo root:

```bash
npm install
npm run build
```

## Start server

```bash
./deploy/local/riotplan-local.sh
```

Defaults:

- `RIOTPLAN_MCP_PORT=3002`
- `RIOTPLAN_PLANS_DIR=./deploy/local/plans`
- `RIOTPLAN_CONTEXT_DIR=./deploy/local/context`

Override values when needed:

```bash
RIOTPLAN_MCP_PORT=3004 \
RIOTPLAN_PLANS_DIR="$HOME/tmp/riotplan/plans" \
RIOTPLAN_CONTEXT_DIR="$HOME/tmp/riotplan/context" \
./deploy/local/riotplan-local.sh
```

Health endpoint:

```bash
curl http://127.0.0.1:3002/health
```

Optional secured mode:

```bash
RIOTPLAN_HTTP_SECURED=true \
RBAC_USERS_PATH=./deploy/cloud-run/rbac-users.example.yaml \
RBAC_KEYS_PATH=./deploy/cloud-run/rbac-keys.example.yaml \
./deploy/local/riotplan-local.sh
```
