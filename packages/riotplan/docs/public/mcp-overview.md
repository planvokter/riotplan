# Running the Server

RiotPlan runs as an HTTP MCP server. You start it, connect your AI assistant, and work through plans entirely via MCP tools.

## Installation

```bash
npx @planvokter/riotplan-mcp-http --plans-dir ~/plans
```

That's it. The server starts on `http://localhost:3000` and stores plans in `~/plans`.

## Configuration

### Command Line Options

```bash
npx @planvokter/riotplan-mcp-http \
  --plans-dir ~/plans \
  --port 3000 \
  --context-dir ~/plans/context
```

| Option | Default | Description |
|--------|---------|-------------|
| `--plans-dir` | *(required)* | Directory where plans are stored |
| `--port` | `3000` | Port to listen on (also set via `PORT` or `MCP_PORT` env var) |
| `--context-dir` | same as plans-dir | Directory for context entities |
| `--debug` | `false` | Enable debug logging |
| `--no-cors` | — | Disable CORS |

### Config File

Create `riotplan-http.config.yaml` in your project root or any parent directory:

```yaml
plansDir: ~/plans
port: 3000
debug: false
cors: true
```

The server auto-discovers this file walking up from the current directory.

### Environment Variables

```bash
PORT=3002 npx @planvokter/riotplan-mcp-http --plans-dir ~/plans
```

Priority: CLI args > config file > environment variables > defaults.

## Connecting AI Assistants

Once the server is running, add it to your assistant's MCP configuration. The MCP endpoint is always at `/mcp` on your server's host and port.

### Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Nanobot

Add to your Nanobot MCP configuration:

```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Restart Your Assistant

After adding the configuration, restart your AI assistant to pick up the new MCP server.

## Authentication (Optional)

For production or shared setups, enable API key authentication:

```bash
npx @planvokter/riotplan-mcp-http \
  --plans-dir ~/plans \
  --secured \
  --rbac-keys-path ./keys.yaml
```

Then configure your assistant with the key:

```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer <your-api-key>"
      }
    }
  }
}
```

## Cloud Mode (Optional)

RiotPlan can back plans to Google Cloud Storage for persistence across machines:

```bash
npx @planvokter/riotplan-mcp-http \
  --cloud-enabled \
  --cloud-plan-bucket my-plans \
  --cloud-context-bucket my-context \
  --cloud-project-id my-gcp-project
```

## Verifying the Server

Check that the server is running:

```bash
curl http://localhost:3000/mcp
```

You should see an MCP response. If your assistant shows the RiotPlan tools after restart, the connection is working.

## Troubleshooting

### Tools not showing up in my assistant

1. Verify the server is running: `curl http://localhost:3000/mcp`
2. Check the MCP config URL matches your server's host and port
3. Restart your assistant after changing MCP configuration

### Port already in use

Use `--port` or `PORT` to specify a different port:

```bash
npx @planvokter/riotplan-mcp-http --plans-dir ~/plans --port 3001
```

### Plans directory not found

The server creates the plans directory automatically if it doesn't exist. If you see permission errors, check that the directory path is writable.

## Next Steps

- [MCP Tools](mcp-tools) — All available tools your assistant can use
- [MCP Resources](mcp-resources) — Read-only data access
- [MCP Prompts](mcp-prompts) — Workflow templates
