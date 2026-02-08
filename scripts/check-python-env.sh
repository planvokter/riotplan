#!/usr/bin/env bash
#
# Check Python Environment for Sampling Tests
#
# Verifies that Python 3.11+ and FastMCP dependencies are installed.
# Provides clear setup instructions if anything is missing.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🐍 Checking Python environment for sampling tests..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    echo ""
    echo "Python 3.11+ is required for sampling tests."
    echo ""
    echo "Install Python:"
    echo "  macOS:   brew install python@3.11"
    echo "  Ubuntu:  sudo apt install python3.11"
    echo ""
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d. -f1)
PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d. -f2)

echo "  Python version: $PYTHON_VERSION"

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 11 ]); then
    echo -e "${RED}❌ Python 3.11+ required (found $PYTHON_VERSION)${NC}"
    echo ""
    echo "Upgrade Python:"
    echo "  macOS:   brew install python@3.11"
    echo "  Ubuntu:  sudo apt install python3.11"
    echo ""
    exit 1
fi

# Check if in tests/sampling directory
if [ ! -d "tests/sampling" ]; then
    echo -e "${RED}❌ tests/sampling directory not found${NC}"
    echo "Run this script from the riotplan root directory"
    exit 1
fi

# Check if requirements.txt exists
if [ ! -f "tests/sampling/requirements.txt" ]; then
    echo -e "${RED}❌ tests/sampling/requirements.txt not found${NC}"
    exit 1
fi

# Check if FastMCP is installed
if ! python3 -c "import fastmcp" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  FastMCP not installed${NC}"
    echo ""
    echo "Install dependencies:"
    echo "  cd tests/sampling"
    echo "  python3 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    echo ""
    exit 1
fi

# Check if pytest is installed
if ! python3 -c "import pytest" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  pytest not installed${NC}"
    echo ""
    echo "Install dependencies:"
    echo "  cd tests/sampling"
    echo "  pip install -r requirements.txt"
    echo ""
    exit 1
fi

# Check for API keys (optional - tests will skip if not set)
HAS_OPENAI=false
HAS_ANTHROPIC=false

if [ -n "$OPENAI_API_KEY" ]; then
    HAS_OPENAI=true
    echo "  OpenAI API key: ✅ configured"
else
    echo "  OpenAI API key: ⚠️  not set (OpenAI tests will be skipped)"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
    HAS_ANTHROPIC=true
    echo "  Anthropic API key: ✅ configured"
else
    echo "  Anthropic API key: ⚠️  not set (Anthropic tests will be skipped)"
fi

if [ "$HAS_OPENAI" = false ] && [ "$HAS_ANTHROPIC" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  No API keys configured${NC}"
    echo ""
    echo "To run sampling tests, set at least one API key:"
    echo "  export OPENAI_API_KEY=sk-..."
    echo "  export ANTHROPIC_API_KEY=sk-ant-..."
    echo ""
    echo "Or create tests/sampling/.env file (see .env.example)"
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Python environment ready for sampling tests${NC}"
exit 0
