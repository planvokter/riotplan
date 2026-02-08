"""
FastMCP Test Suite Configuration

Provides fixtures for testing RiotPlan with MCP sampling.
Uses a MOCK sampling handler by default for fast, deterministic tests.
"""

import os
import sys
import pytest
import pytest_asyncio
import tempfile
import shutil
import json
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))


class MockSamplingHandler:
    """
    Mock sampling handler that returns fake but valid responses.
    
    This allows testing the MCP sampling flow without hitting real APIs.
    Tests run fast, don't cost money, and are deterministic.
    """
    
    def __init__(self, name: str = "mock"):
        self.name = name
        self.call_count = 0
        self.last_request = None
    
    async def __call__(self, messages, params, context):
        """
        Handle a sampling request by returning a mock response.
        
        Returns a valid plan generation response that RiotPlan can parse.
        """
        from mcp.types import CreateMessageResult, TextContent
        
        self.call_count += 1
        self.last_request = {
            "messages": messages,
            "params": params,
        }
        
        # Extract step count from the request if present
        step_count = 3  # default
        for msg in messages:
            if hasattr(msg, 'content') and hasattr(msg.content, 'text'):
                text = msg.content.text
                if 'steps":' in text or 'steps:' in text.lower():
                    # Try to find step count in request
                    import re
                    match = re.search(r'(\d+)\s*steps', text.lower())
                    if match:
                        step_count = int(match.group(1))
        
        # Generate a mock plan response that matches what RiotPlan expects
        mock_plan = self._generate_mock_plan(step_count)
        
        return CreateMessageResult(
            role="assistant",
            content=TextContent(
                type="text",
                text=mock_plan,
            ),
            model=f"mock-model-{self.name}",
            stopReason="endTurn",
        )
    
    def _generate_mock_plan(self, step_count: int) -> str:
        """Generate a mock plan response in the format RiotPlan expects."""
        steps = []
        for i in range(1, step_count + 1):
            step_num = str(i).zfill(2)
            steps.append({
                "number": i,
                "title": f"Mock Step {i}",
                "objective": f"Complete mock task {i} for testing",
                "background": f"Background context for step {i}",
                "tasks": [
                    {"id": f"{step_num}.1", "description": f"Task {i}.1 description"},
                    {"id": f"{step_num}.2", "description": f"Task {i}.2 description"},
                ],
                "acceptanceCriteria": [f"Criterion {i}.1", f"Criterion {i}.2"],
                "testing": f"Test step {i} by verifying mock data",
                "filesChanged": [f"mock/step{i}.ts"],
                "notes": f"Notes for step {i}",
            })
        
        plan = {
            "summary": "This is a mock plan generated for testing MCP sampling. It validates that the sampling flow works correctly without hitting real APIs.",
            "approach": "Mock approach using deterministic test data. This allows fast, repeatable tests.",
            "successCriteria": "All tests pass. No real API calls are made. The sampling protocol is correctly implemented.",
            "steps": steps,
        }
        
        return json.dumps(plan, indent=2)


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


@pytest_asyncio.fixture(params=["mock"])
async def sampling_client(request, riotplan_server_path):
    """
    Create a FastMCP client with mock sampling handler.
    
    Uses mock handler by default for fast, deterministic tests.
    """
    from fastmcp.client import Client
    
    handler_type = request.param
    handler = MockSamplingHandler(name=handler_type)
    
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    async with client:
        yield client, handler_type


@pytest_asyncio.fixture
async def mock_client(riotplan_server_path):
    """
    Create a FastMCP client with mock sampling handler.
    
    Use this fixture for most tests - fast and deterministic.
    """
    from fastmcp.client import Client
    
    handler = MockSamplingHandler(name="mock")
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    async with client:
        yield client


# =============================================================================
# Real API fixtures (for integration tests, use sparingly)
# =============================================================================

@pytest_asyncio.fixture
async def openai_client(riotplan_server_path):
    """
    Create a FastMCP client with REAL OpenAI sampling handler.
    
    WARNING: This hits the real OpenAI API and costs money!
    Use mock_client for most tests.
    """
    if not os.getenv("OPENAI_API_KEY"):
        pytest.skip("OPENAI_API_KEY not set")
    
    from fastmcp.client import Client
    from fastmcp.client.sampling.handlers.openai import OpenAISamplingHandler
    
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    handler = OpenAISamplingHandler(default_model=model)
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    async with client:
        yield client


@pytest_asyncio.fixture
async def anthropic_client(riotplan_server_path):
    """
    Create a FastMCP client with REAL Anthropic sampling handler.
    
    WARNING: This hits the real Anthropic API and costs money!
    Use mock_client for most tests.
    """
    if not os.getenv("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")
    
    from fastmcp.client import Client
    from fastmcp.client.sampling.handlers.anthropic import AnthropicSamplingHandler
    
    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    handler = AnthropicSamplingHandler(default_model=model)
    client = Client(riotplan_server_path, sampling_handler=handler)
    
    async with client:
        yield client
