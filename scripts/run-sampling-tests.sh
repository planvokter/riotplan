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

echo ""
echo "Running sampling tests..."
echo ""

# Change to tests/sampling directory
cd tests/sampling

# Check if fastmcp.sampling is available
if ! python3 -c "from fastmcp.sampling import OpenAISamplingHandler" 2>/dev/null; then
    echo ""
    echo -e "${YELLOW}⚠️  fastmcp.sampling module not available${NC}"
    echo ""
    echo "Note: fastmcp.sampling is a beta feature and may not be in all versions."
    echo "Skipping sampling tests for now."
    echo ""
    cd ../..
    exit 0
fi

# Run pytest with verbose output
# Use venv if available, otherwise use system python3
if [ -f "venv/bin/python" ]; then
    if venv/bin/python -m pytest test_sampling.py -v -s; then
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
        echo "  python -m pytest test_sampling.py -v -s"
        echo ""
        cd ../..
        exit 1
    fi
else
    if python3 -m pytest test_sampling.py -v -s; then
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
        echo "  python3 -m pytest test_sampling.py -v -s"
        echo ""
        cd ../..
        exit 1
    fi
fi
