#!/usr/bin/env bash
#
# Run Sampling Tests
#
# Executes Python FastMCP tests for RiotPlan sampling implementation.
# Gracefully skips if Python environment is not set up.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  FastMCP Sampling Tests${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check Python environment
if ! bash scripts/check-python-env.sh; then
    echo ""
    echo -e "${YELLOW}⚠️  Skipping sampling tests (Python environment not ready)${NC}"
    echo ""
    echo "To enable sampling tests:"
    echo "  1. Install Python 3.11+"
    echo "  2. cd tests/sampling && pip install -r requirements.txt"
    echo "  3. Set API keys (OPENAI_API_KEY or ANTHROPIC_API_KEY)"
    echo ""
    exit 0  # Exit success - don't fail the build
fi

# FastMCP sampling tests currently exercise stdio MCP transport.
# RiotPlan now ships HTTP MCP as the runtime transport, so skip these
# tests unless explicitly forced while we migrate the sampling harness.
if [ ! -f "dist/mcp-server.js" ] && [ -f "dist/mcp-server-http.js" ] && [ "${RIOTPLAN_FORCE_SAMPLING_STDIO_TESTS}" != "1" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Skipping sampling tests (stdio harness not available in HTTP-only build)${NC}"
    echo "Set RIOTPLAN_FORCE_SAMPLING_STDIO_TESTS=1 to force-run current sampling tests."
    echo ""
    exit 0
fi

echo ""
echo "Running sampling tests..."
echo ""

# Change to tests/sampling directory
cd tests/sampling

# Determine which Python to use
if [ -f "venv/bin/python" ]; then
    PYTHON="venv/bin/python"
else
    PYTHON="python3"
fi

# Check if fastmcp.client.sampling.handlers is available
if ! $PYTHON -c "from fastmcp.client.sampling.handlers.openai import OpenAISamplingHandler" 2>/dev/null; then
    echo ""
    echo -e "${YELLOW}⚠️  fastmcp.client.sampling.handlers module not available${NC}"
    echo ""
    echo "Note: FastMCP sampling handlers require fastmcp>=2.11.0 with [openai] or [anthropic] extras."
    echo "Install with: pip install 'fastmcp[openai]>=2.11.0' 'fastmcp[anthropic]>=2.14.1'"
    echo "Skipping sampling tests for now."
    echo ""
    cd ../..
    exit 0
fi

# Run pytest with mock handler (fast, no API calls)
# Use -m integration to run real API tests
if [ -f "venv/bin/python" ]; then
    PYTEST_CMD="venv/bin/python -m pytest"
else
    PYTEST_CMD="python3 -m pytest"
fi

# Check for --integration flag
if [[ "$*" == *"--integration"* ]]; then
    echo -e "${YELLOW}Running integration tests (real API calls)...${NC}"
    if $PYTEST_CMD test_sampling.py -v -s; then
        TEST_RESULT=0
    else
        TEST_RESULT=1
    fi
else
    echo "Running mock tests (no API calls)..."
    if $PYTEST_CMD test_sampling.py -v -s -m "not integration"; then
        TEST_RESULT=0
    else
        TEST_RESULT=1
    fi
fi

if [ $TEST_RESULT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ All sampling tests passed!${NC}"
    echo ""
    cd ../..
    exit 0
else
    echo ""
    echo -e "${RED}❌ Sampling tests failed${NC}"
    echo ""
    echo "Check the output above for details."
    echo "To debug:"
    echo "  cd tests/sampling"
    echo "  source venv/bin/activate"
    echo "  $PYTEST_CMD $PYTEST_ARGS"
    echo ""
    echo "To run integration tests with real APIs:"
    echo "  ./scripts/run-sampling-tests.sh --integration"
    echo ""
    cd ../..
    exit 1
fi
