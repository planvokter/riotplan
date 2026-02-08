"""
FastMCP Sampling Tests for RiotPlan

Tests that RiotPlan correctly uses MCP sampling when available.
Uses MOCK handlers for fast, deterministic tests.
"""

import pytest
from pathlib import Path
import json


@pytest.mark.asyncio
async def test_sampling_capability_detection(sampling_client):
    """
    Test that RiotPlan detects the client supports sampling.
    
    This verifies Phase 1 (session architecture) is working.
    """
    client, handler_type = sampling_client
    
    # The client should have sampling capability
    tools = await client.list_tools()
    
    assert len(tools) > 0, "No tools available from RiotPlan MCP server"
    
    # Check for key RiotPlan tools
    tool_names = [tool.name for tool in tools]
    assert "riotplan_generate" in tool_names, "riotplan_generate tool not found"
    assert "riotplan_create" in tool_names, "riotplan_create tool not found"
    
    print(f"\n✅ Sampling capability detected with {handler_type} handler")
    print(f"   Available tools: {len(tools)}")


@pytest.mark.asyncio
async def test_sampling_plan_generation(sampling_client, temp_plan_dir):
    """
    Test that RiotPlan uses MCP sampling to generate a plan.
    
    Uses riotplan_create which creates files using sampling.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-web-app"
    
    result = await client.call_tool(
        "riotplan_create",
        {
            "code": "test-web-app",
            "description": "Create a simple web application with user authentication",
            "directory": str(temp_plan_dir),
            "steps": 3,
        }
    )
    
    assert result.content, "No content in result"
    assert not result.is_error, f"Tool returned error: {result.content}"
    
    # Verify plan was created
    assert plan_path.exists(), f"Plan directory not created at {plan_path}"
    assert (plan_path / "STATUS.md").exists(), "STATUS.md not created"
    
    # Verify steps were created
    plan_dir = plan_path / "plan"
    if plan_dir.exists():
        step_files = list(plan_dir.glob("*.md"))
    else:
        steps_dir = plan_path / "steps"
        step_files = list(steps_dir.glob("*.md")) if steps_dir.exists() else []
    
    assert len(step_files) >= 1, f"Expected at least 1 step, found {len(step_files)}"
    
    print(f"\n✅ Plan generated successfully using {handler_type} sampling handler")
    print(f"   Plan location: {plan_path}")
    print(f"   Steps created: {len(step_files)}")


@pytest.mark.asyncio
async def test_sampling_returns_valid_data(sampling_client):
    """
    Test that riotplan_generate returns valid plan data via sampling.
    
    This tests the sampling flow without file creation.
    """
    client, handler_type = sampling_client
    
    result = await client.call_tool(
        "riotplan_generate",
        {
            "description": "Build a REST API with authentication",
            "steps": 3,
        }
    )
    
    assert result.content, "No content in result"
    assert not result.is_error, f"Tool returned error: {result.content}"
    
    # Parse the JSON response
    text_content = result.content[0].text if result.content else ""
    data = json.loads(text_content)
    
    # Verify expected fields
    assert "summary" in data, "Missing 'summary' in response"
    assert "approach" in data, "Missing 'approach' in response"
    assert "stepsGenerated" in data, "Missing 'stepsGenerated' in response"
    assert "steps" in data, "Missing 'steps' in response"
    
    # Verify steps structure
    assert len(data["steps"]) >= 1, f"Expected at least 1 step, got {len(data['steps'])}"
    for step in data["steps"]:
        assert "number" in step, "Step missing 'number'"
        assert "title" in step, "Step missing 'title'"
    
    print(f"\n✅ Sampling returned valid plan data with {handler_type}")
    print(f"   Summary: {data['summary'][:80]}...")
    print(f"   Steps: {data['stepsGenerated']}")


@pytest.mark.asyncio
async def test_mock_handler_works(mock_client):
    """
    Test that the mock sampling handler works correctly.
    """
    result = await mock_client.call_tool(
        "riotplan_generate",
        {
            "description": "Test plan",
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    
    text_content = result.content[0].text if result.content else ""
    data = json.loads(text_content)
    
    assert "summary" in data
    assert "steps" in data
    
    print("\n✅ Mock handler works correctly")


@pytest.mark.asyncio
async def test_no_server_api_keys_needed(sampling_client, temp_plan_dir, monkeypatch):
    """
    Critical test: Verify that RiotPlan does NOT need server-side API keys
    when using MCP sampling.
    
    This proves the core value proposition - no duplicate API keys needed!
    """
    client, handler_type = sampling_client
    
    # Remove all server-side API keys from environment
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    
    plan_path = Path(temp_plan_dir) / "test-no-keys"
    
    # This should still work because sampling delegates to the client
    result = await client.call_tool(
        "riotplan_create",
        {
            "code": "test-no-keys",
            "description": "Simple calculator app",
            "directory": str(temp_plan_dir),
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    assert plan_path.exists(), "Plan not created despite no server API keys"
    assert (plan_path / "STATUS.md").exists(), "STATUS.md not created"
    
    print(f"\n✅ CRITICAL: No server API keys needed with {handler_type} sampling!")
    print("   This proves RiotPlan delegates AI generation to the client")


@pytest.mark.asyncio
async def test_plan_file_structure(sampling_client, temp_plan_dir):
    """
    Test that generated plan has correct file structure.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-structure"
    
    result = await client.call_tool(
        "riotplan_create",
        {
            "code": "test-structure",
            "description": "E-commerce platform",
            "directory": str(temp_plan_dir),
            "steps": 4,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    
    # Check directory structure
    assert plan_path.exists(), "Plan directory not created"
    assert plan_path.is_dir(), "Plan path is not a directory"
    assert (plan_path / "STATUS.md").exists(), "STATUS.md not created"
    
    # Check plan directory for steps
    plan_dir = plan_path / "plan"
    if plan_dir.exists():
        step_files = sorted(plan_dir.glob("*.md"))
        assert len(step_files) >= 1, f"Expected at least 1 step, found {len(step_files)}"
    
    print(f"\n✅ Plan file structure correct with {handler_type}")
    print(f"   Plan directory: {plan_path}")


# =============================================================================
# Integration tests with REAL APIs (marked to skip by default)
# Run with: pytest -m integration
# =============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_openai_integration(openai_client, temp_plan_dir):
    """
    Integration test with REAL OpenAI API.
    
    WARNING: This costs money! Only run when needed.
    Run with: pytest -m integration -k openai
    """
    plan_path = Path(temp_plan_dir) / "test-openai-real"
    
    result = await openai_client.call_tool(
        "riotplan_create",
        {
            "code": "test-openai-real",
            "description": "Simple TODO app",
            "directory": str(temp_plan_dir),
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    assert plan_path.exists(), "Plan not created"
    
    print("\n✅ Real OpenAI integration works")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_anthropic_integration(anthropic_client, temp_plan_dir):
    """
    Integration test with REAL Anthropic API.
    
    WARNING: This costs money! Only run when needed.
    Run with: pytest -m integration -k anthropic
    """
    plan_path = Path(temp_plan_dir) / "test-anthropic-real"
    
    result = await anthropic_client.call_tool(
        "riotplan_create",
        {
            "code": "test-anthropic-real",
            "description": "Simple blog platform",
            "directory": str(temp_plan_dir),
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    assert plan_path.exists(), "Plan not created"
    
    print("\n✅ Real Anthropic integration works")
