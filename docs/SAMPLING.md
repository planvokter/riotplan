# MCP Sampling in RiotPlan

RiotPlan supports **MCP sampling**, allowing it to use your IDE's AI access instead of requiring separate API keys.

## What is MCP Sampling?

MCP sampling lets RiotPlan delegate AI generation to the MCP client (your IDE). This means:

- ✅ **No duplicate API keys needed**
- ✅ **No duplicate costs**
- ✅ **Zero configuration**
- ✅ **Instant setup**

## How It Works

```
┌─────────────────┐
│  Your IDE       │  ← Already has AI access
│  (Cursor, etc)  │  ← Already authenticated
└────────┬────────┘
         │ MCP
         │
┌────────▼────────┐
│    RiotPlan     │  ← Needs AI generation
│                 │  ← NO API keys needed!
└─────────────────┘
```

When you call `riotplan_generate`:
1. RiotPlan detects your IDE supports sampling
2. RiotPlan asks your IDE to generate the plan
3. Your IDE uses its AI access (no extra keys needed)
4. RiotPlan receives and saves the generated plan

## Supported Clients

### ✅ Currently Working

- **FastMCP** (Python): Full sampling support for testing
- **GitHub Copilot**: Claims sampling support (untested)
- **mcp-go** (Go): Working sampling handlers

### ❌ Not Yet Supported

- **Cursor**: No sampling support (as of Feb 2026)
- **Claude Desktop**: No sampling support
- **Claude Code**: No sampling support

We built sampling support anyway to be future-ready and to advocate for wider adoption.

## Automatic Detection

RiotPlan automatically detects if sampling is available:

```
Priority 1: Client supports sampling → Use sampling (no keys needed)
Priority 2: API keys configured → Use direct API calls
Priority 3: Nothing available → Clear error message
```

**You don't need to configure anything.** It just works.

## Testing with FastMCP

Want to test RiotPlan's sampling implementation? Use FastMCP:

### Setup

```bash
cd tests/sampling
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Configure API Keys

```bash
cp .env.example .env
# Edit .env and add your keys
```

### Run Tests

```bash
pytest -v
```

See `tests/sampling/README.md` for detailed instructions.

## Using Direct API Keys (Fallback)

If your IDE doesn't support sampling, RiotPlan falls back to direct API calls.

### Set API Keys

```bash
# Anthropic (recommended)
export ANTHROPIC_API_KEY="sk-ant-..."

# Or OpenAI
export OPENAI_API_KEY="sk-..."

# Or Google
export GOOGLE_API_KEY="..."
```

### Verify Setup

```bash
riotplan generate --description "Test plan" --steps 2
```

## Error Messages

RiotPlan provides clear error messages when AI isn't available:

```
❌ No AI provider available for RiotPlan.

Your client (Cursor) does not support MCP sampling, and no API keys are configured.

To use RiotPlan's AI generation features, either:

1. Use a client that supports MCP sampling:
   - GitHub Copilot (supports sampling)
   - FastMCP (Python framework for testing)

2. Set up an API key:
   - ANTHROPIC_API_KEY for Claude models (recommended)
   - OPENAI_API_KEY for GPT models
   - GOOGLE_API_KEY for Gemini models

3. Create plan steps manually:
   - Use riotplan_step with action=add to add steps without AI

For more information: https://github.com/planvokter/riotplan#ai-providers
```

## Architecture

### Session-Based Detection

RiotPlan tracks sampling availability per session:

```typescript
interface SessionContext {
  sessionId: string;
  transport: 'stdio' | 'http';
  clientInfo: { name: string; version: string; } | null;
  capabilities: { sampling?: { tools?: {}; }; };
  samplingAvailable: boolean;
  providerMode: 'sampling' | 'direct' | 'none';
}
```

### Provider Selection

```typescript
// Automatic provider loading
const provider = await loadProvider({
  name: 'anthropic',  // Preference
  session: currentSession,  // Contains capability info
});

// RiotPlan automatically chooses:
// - SamplingProvider if session.providerMode === 'sampling'
// - AnthropicProvider if API key available
// - Error with guidance if nothing available
```

## FAQ

### Q: Do I need API keys if my IDE supports sampling?

**A: No!** That's the whole point. RiotPlan uses your IDE's AI access.

### Q: Does sampling work with Cursor?

**A: Not yet** (as of Feb 2026). We're advocating for Cursor to add sampling support. In the meantime, use direct API keys.

### Q: Can I test sampling without an IDE?

**A: Yes!** Use FastMCP (Python) to test sampling locally. See `tests/sampling/README.md`.

### Q: What if I want to use my own API keys anyway?

**A: You can!** Just set the environment variables. RiotPlan will use direct API calls instead of sampling.

### Q: Does sampling cost more?

**A: No!** You're already paying your IDE for AI access. Sampling just lets RiotPlan use that access.

### Q: Which AI models work with sampling?

**A: Any model your IDE supports.** RiotPlan sends model preferences, but the IDE decides which model to actually use.

### Q: Can I force sampling mode?

**A: No need.** RiotPlan automatically uses sampling when available. If you want to test without sampling, just don't configure sampling in your client.

### Q: What about privacy/security?

**A: Same as your IDE.** Sampling uses your IDE's AI connection, so privacy/security is the same as when you use AI features in your IDE.

## Troubleshooting

### "No AI provider available"

**Cause**: Your IDE doesn't support sampling and no API keys are configured.

**Solution**: Either:
1. Set API keys (see "Using Direct API Keys" above)
2. Use FastMCP for testing
3. Create plan steps manually with `riotplan_step` (`action: "add"`)

### "User rejected the sampling request"

**Cause**: Your IDE prompted you to approve AI generation and you declined.

**Solution**: Try again and approve the request, or use direct API keys.

### Tests fail with "FastMCP not installed"

**Cause**: Python dependencies not installed.

**Solution**:
```bash
cd tests/sampling
pip install -r requirements.txt
```

## Resources

- **MCP Specification**: https://modelcontextprotocol.io/specification/2025-11-25/server/sampling
- **FastMCP**: https://github.com/jlowin/fastmcp
- **RiotPlan Tests**: `tests/sampling/`
- **execution-sampling Package**: https://github.com/kjerneverk/execution-sampling

## Advocacy

Want MCP sampling in your IDE? Let them know!

- **Cursor**: Tweet @cursor_ai or file a feature request
- **Anthropic**: Request sampling in Claude Desktop/Code
- **Others**: Ask your IDE vendor for MCP sampling support

The more users ask, the faster it will happen.

---

**Next**: [Testing Guide](./TESTING.md) | [Architecture](./ARCHITECTURE.md)
