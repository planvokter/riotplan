# FastMCP Sampling Tests

This directory contains Python tests that verify RiotPlan's MCP sampling implementation using FastMCP.

## Overview

These tests validate that RiotPlan correctly:
1. Detects when a client supports MCP sampling
2. Uses sampling instead of requiring API keys
3. Formats sampling requests correctly
4. Handles responses from both OpenAI and Anthropic handlers

## Prerequisites

- **Python 3.11+** (required by FastMCP)
- **Node.js 24+** (for building RiotPlan)
- **API Keys**: At least one of:
  - `OPENAI_API_KEY` for OpenAI tests
  - `ANTHROPIC_API_KEY` for Anthropic tests

## Setup

### 1. Build RiotPlan

First, ensure RiotPlan is built:

```bash
cd /path/to/riotplan
npm run build
```

This creates `dist/mcp-server.js` which the tests will use.

### 2. Set up Python Environment

Create a virtual environment and install dependencies:

```bash
cd tests/sampling
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Configure API Keys

Copy the example environment file and add your keys:

```bash
cp .env.example .env
# Edit .env and add your API keys
```

Example `.env`:

```bash
# Required: At least one API key
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional: Override default models
OPENAI_MODEL=gpt-4o
ANTHROPIC_MODEL=claude-sonnet-4-5
```

## Running Tests

### Run All Tests

```bash
pytest -v
```

This runs tests with both OpenAI and Anthropic handlers (parametrized).

### Run Specific Handler Tests

```bash
# OpenAI only
pytest -v -k openai

# Anthropic only
pytest -v -k anthropic
```

### Run Specific Test

```bash
pytest -v test_sampling.py::test_sampling_plan_generation
```

### Run with Output

```bash
pytest -v -s
```

The `-s` flag shows print statements, which display helpful progress information.

## Test Structure

### Fixtures (`conftest.py`)

- **`riotplan_server_path`**: Path to the built MCP server
- **`temp_plan_dir`**: Temporary directory for test plans (auto-cleaned)
- **`sampling_client`**: Parametrized fixture for both OpenAI and Anthropic
- **`openai_client`**: Specific OpenAI client
- **`anthropic_client`**: Specific Anthropic client

### Tests (`test_sampling.py`)

1. **`test_sampling_capability_detection`**: Verifies RiotPlan detects sampling support
2. **`test_sampling_plan_generation`**: End-to-end plan generation via sampling
3. **`test_sampling_request_format`**: Validates request formatting
4. **`test_sampling_with_elaborations`**: Tests context passing
5. **`test_openai_handler_specifically`**: OpenAI-specific test
6. **`test_anthropic_handler_specifically`**: Anthropic-specific test

## Troubleshooting

### "RiotPlan MCP server not found"

**Solution**: Build RiotPlan first:
```bash
cd ../..  # Go to riotplan root
npm run build
```

### "OPENAI_API_KEY not set - skipping OpenAI tests"

**Solution**: Add your API key to `.env`:
```bash
echo "OPENAI_API_KEY=sk-..." >> .env
```

### "No module named 'fastmcp'"

**Solution**: Install dependencies:
```bash
pip install -r requirements.txt
```

### Tests hang or timeout

**Cause**: The AI provider might be slow or rate-limited.

**Solution**: 
- Check your API key is valid
- Verify you have API credits
- Try with a different handler

### Import errors

**Cause**: Python version too old.

**Solution**: Use Python 3.11+:
```bash
python3 --version  # Should be 3.11 or higher
```

## CI/CD Integration

These tests are integrated into:
- **`npm run precommit`**: Runs before commits (if Python is available)
- **GitHub Actions**: Runs on release workflow

Tests are gracefully skipped if:
- Python is not installed
- API keys are not configured
- Dependencies are missing

See `../../scripts/run-sampling-tests.sh` for the integration script.

## What Gets Tested

### Phase 1: Session Architecture ✅
- Session creation during MCP initialization
- Capability detection (sampling vs. direct)
- Provider mode determination

### Phase 2: execution-sampling Package ✅
- SamplingProvider implementation
- Request/response conversion
- Error handling

### Phase 3: Integration ✅
- Provider loading with session context
- Automatic mode selection
- Error messages

### Phase 4: End-to-End ✅
- Full plan generation via sampling
- Multiple AI providers (OpenAI, Anthropic)
- Context passing (elaborations)

## Expected Output

Successful test run:

```
tests/sampling/test_sampling.py::test_sampling_capability_detection[openai] PASSED
✅ Sampling capability detected with openai handler
   Available tools: 25

tests/sampling/test_sampling.py::test_sampling_plan_generation[openai] PASSED
✅ Plan generated successfully using openai sampling handler
   Plan location: /tmp/riotplan_test_xyz/test-web-app
   Steps created: 3

tests/sampling/test_sampling.py::test_sampling_plan_generation[anthropic] PASSED
✅ Plan generated successfully using anthropic sampling handler
   Plan location: /tmp/riotplan_test_abc/test-web-app
   Steps created: 3

======================== 6 passed in 45.23s ========================
```

## Additional Resources

- [FastMCP Documentation](https://github.com/jlowin/fastmcp)
- [MCP Specification](https://modelcontextprotocol.io)
- [RiotPlan Sampling Plan](../../plans/riotplan-sampling/)

## Support

If tests fail consistently:
1. Check the troubleshooting section above
2. Review test output for specific errors
3. Open an issue: https://github.com/kjerneverk/riotplan/issues
