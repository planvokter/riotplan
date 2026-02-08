"""
FastMCP Test Suite Configuration

Provides fixtures for testing RiotPlan with MCP sampling.
"""

import os
import sys
import pytest
import tempfile
import shutil
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


@pytest.fixture(scope="session")
def riotplan_server_path():
    """
    Path to the RiotPlan MCP server executable.
    
    Returns the path to dist/mcp-server.js in the riotplan package.
    """
    # Get path to riotplan root (two levels up from tests/sampling/)
    riotplan_root = Path(__file__).parent.parent.parent
    server_path = riotplan_root / "dist" / "mcp-server.js"
    
    if not server_path.exists():
        pytest.skip(
            f"RiotPlan MCP server not found at {server_path}. "
            "Run 'npm run build' first."
        )
    
    return str(server_path)


@pytest.fixture
def temp_plan_dir():
    """
    Create a temporary directory for test plans.
    
    Automatically cleaned up after the test.
    """
    temp_dir = tempfile.mkdtemp(prefix="riotplan_test_")
    yield temp_dir
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture(params=["openai", "anthropic"])
def sampling_client(request, riotplan_server_path):
    """
    Create a FastMCP client with sampling handler.
    
    Parametrized to test with both OpenAI and Anthropic handlers.
    """
    handler_type = request.param
    
    # Check for required API keys
    if handler_type == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            pytest.skip("OPENAI_API_KEY not set - skipping OpenAI tests")
        
        from fastmcp.client import Client
        from fastmcp.sampling import OpenAISamplingHandler
        
        model = os.getenv("OPENAI_MODEL", "gpt-4o")
        handler = OpenAISamplingHandler(default_model=model)
        
    else:  # anthropic
        if not os.getenv("ANTHROPIC_API_KEY"):
            pytest.skip("ANTHROPIC_API_KEY not set - skipping Anthropic tests")
        
        from fastmcp.client import Client
        from fastmcp.sampling import AnthropicSamplingHandler
        
        model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
        handler = AnthropicSamplingHandler(default_model=model)
    
    # Create client with sampling handler
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    yield client, handler_type
    
    # Cleanup
    try:
        client.close()
    except Exception:
        pass


@pytest.fixture
def openai_client(riotplan_server_path):
    """
    Create a FastMCP client with OpenAI sampling handler.
    
    Use this fixture when you specifically want to test with OpenAI.
    """
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY not set")
    
    from fastmcp.client import Client
    from fastmcp.sampling import OpenAISamplingHandler
    
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    handler = OpenAISamplingHandler(default_model=model)
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    yield client
    
    try:
        client.close()
    except Exception:
        pass


@pytest.fixture
def anthropic_client(riotplan_server_path):
    """
    Create a FastMCP client with Anthropic sampling handler.
    
    Use this fixture when you specifically want to test with Anthropic.
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")
    
    from fastmcp.client import Client
    from fastmcp.sampling import AnthropicSamplingHandler
    
    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    handler = AnthropicSamplingHandler(default_model=model)
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    yield client
    
    try:
        client.close()
    except Exception:
        pass
