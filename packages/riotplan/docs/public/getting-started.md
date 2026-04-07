# Getting Started

## Why RiotPlan?

AI coding assistants can generate plans in seconds. Cursor has a plan mode. Claude Code has a plan mode. But those plans are ephemeral — they vanish when the conversation ends. There's no record of what you considered, what you rejected, or why you chose a particular approach.

RiotPlan is different. It's an **MCP server** that stores your plans as persistent artifacts. When you look back at your work weeks later, you can see not just what was built, but *how you planned it*.

### What RiotPlan gives you that built-in plan modes don't:

- **Persistence** — Plans live on disk, not in a chat window. They survive session resets, context window limits, and tool crashes.
- **Thinking time** — Good plans sometimes need hours or days. RiotPlan's lifecycle (idea → shaping → built → executing → completed) supports that. Explore an idea on Monday, shape approaches on Tuesday, start executing on Wednesday.
- **Multiple versions** — Create several plans for the same problem. Compare approaches before committing. Kill the ones that don't work.
- **A record** — Every plan has a timeline. You can see what changed, when, and why. This is invaluable when you're reviewing past work or onboarding someone new.
- **Human-in-the-loop** — Plans aren't just for AI. You can review steps, add feedback, adjust scope, and redirect before execution starts. For example: an AI generates a plan, stops before step 4 to ask "which illustration style do you prefer?", waits for your input, then continues.
- **Multi-agent execution** — Different AI agents can work on different steps of the same plan. A specialized coding agent handles the implementation steps. A writing agent handles the documentation. A researcher agent explores the architecture. Each agent connects to the same RiotPlan server and sees the full plan context.

## What RiotPlan Is

RiotPlan is an **MCP server** (`@planvokter/riotplan-mcp-http`) that you run and connect your AI assistant to. It stores plans on disk (or in GCS for cloud setups) and exposes tools for creating, managing, and executing them.

There is no CLI. There is no standalone app. You interact with RiotPlan entirely through your AI assistant via MCP.

## Quick Start

### 1. Run the Server

```bash
npx @planvokter/riotplan-mcp-http --plans-dir ~/plans
```

This starts the MCP server on `http://localhost:3000`. Plans are stored in `~/plans`.

### 2. Connect Your AI Assistant

Add the server to your assistant's MCP configuration:

**Cursor** (`~/.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Claude Code** (`~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

**Nanobot** (in your MCP config):
```json
{
  "mcpServers": {
    "riotplan": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Then restart your assistant.

### 3. Create a Plan

Ask your assistant:

> "Create a plan called `user-auth` for implementing JWT authentication."

The assistant uses RiotPlan's MCP tools to create a structured plan with steps, status tracking, and a full lifecycle.

### 4. Work Through It

> "Show me the status of user-auth."
> "Start step 1."
> "I'm done with step 1. Mark it complete."
> "Add a note to step 2 about the edge case I found."

Your assistant handles all the bookkeeping. The plan files live on disk — you can inspect them anytime.

### 5. Pause for Human Feedback

Plans can stop at any point to ask for input. Your assistant can:

> "I've drafted the image generation plan. Before I proceed, which illustration style do you prefer — vector or photorealistic?"

The plan waits. You review the output so far, provide feedback, and your assistant continues with that context baked in.

## Next Steps

- [Running the Server](mcp-overview) — Server configuration, ports, cloud mode, and authentication
- [MCP Tools](mcp-tools) — All available tools your assistant can use
- [Core Concepts](core-concepts) — Plans, steps, lifecycle, and STATUS.md
- [Plan Structure](plan-structure) — What's inside a plan directory
