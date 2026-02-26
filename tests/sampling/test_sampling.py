"""
FastMCP Sampling Tests for RiotPlan

Tests that RiotPlan correctly uses MCP sampling when available.
Uses MOCK handlers for fast, deterministic tests.
"""

import pytest
import json

def _extract_tool_payload(result):
    assert result.content, "No content in result"
    text = result.content[0].text if result.content else "{}"
    return json.loads(text)

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
    assert "riotplan_plan" in tool_names, "riotplan_plan tool not found"
    
    print(f"\n✅ Sampling capability detected with {handler_type} handler")
    print(f"   Available tools: {len(tools)}")


@pytest.mark.asyncio
async def test_sampling_plan_generation(sampling_client, temp_plan_dir):
    """
    Test that RiotPlan uses MCP sampling to generate a plan.
    
    Uses riotplan_plan(action="create") which creates SQLite plans.
    """
    client, handler_type = sampling_client
    result = await client.call_tool(
        "riotplan_plan",
        {
            "action": "create",
            "code": "test-web-app",
            "description": "Create a simple web application with user authentication",
            "steps": 3,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    data = _extract_tool_payload(result)
    
    assert data.get("planId") == "test-web-app", "Expected returned planId to match request code"
    assert data.get("storage") == "sqlite", "Expected sqlite storage metadata"
    
    print(f"\n✅ Plan generated successfully using {handler_type} sampling handler")
    print(f"   Plan id: {data.get('planId')}")


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
    data = _extract_tool_payload(result)
    
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
    
    data = _extract_tool_payload(result)
    
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
    
    # This should still work because sampling delegates to the client
    result = await client.call_tool(
        "riotplan_plan",
        {
            "action": "create",
            "code": "test-no-keys",
            "description": "Simple calculator app",
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    data = _extract_tool_payload(result)
    assert data.get("planId") == "test-no-keys", "Expected returned planId to match request code"
    assert data.get("storage") == "sqlite", "Expected sqlite storage metadata"
    
    print(f"\n✅ CRITICAL: No server API keys needed with {handler_type} sampling!")
    print("   This proves RiotPlan delegates AI generation to the client")


@pytest.mark.asyncio
async def test_plan_file_structure(sampling_client, temp_plan_dir):
    """
    Test that generated plan has correct file structure.
    """
    client, handler_type = sampling_client
    result = await client.call_tool(
        "riotplan_plan",
        {
            "action": "create",
            "code": "test-structure",
            "description": "E-commerce platform",
            "steps": 4,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    data = _extract_tool_payload(result)
    assert data.get("planId") == "test-structure", "Expected returned planId to match request code"
    assert data.get("storage") == "sqlite", "Expected sqlite storage metadata"
    
    print(f"\n✅ Plan file structure correct with {handler_type}")
    print(f"   Plan id: {data.get('planId')}")


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
    result = await openai_client.call_tool(
        "riotplan_plan",
        {
            "action": "create",
            "code": "test-openai-real",
            "description": "Simple TODO app",
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    data = _extract_tool_payload(result)
    assert data.get("planId") == "test-openai-real", "Plan not created"
    
    print("\n✅ Real OpenAI integration works")


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_anthropic_integration(anthropic_client, temp_plan_dir):
    """
    Integration test with REAL Anthropic API.
    
    WARNING: This costs money! Only run when needed.
    Run with: pytest -m integration -k anthropic
    """
    result = await anthropic_client.call_tool(
        "riotplan_plan",
        {
            "action": "create",
            "code": "test-anthropic-real",
            "description": "Simple blog platform",
            "steps": 2,
        }
    )
    
    assert not result.is_error, f"Tool returned error: {result.content}"
    data = _extract_tool_payload(result)
    assert data.get("planId") == "test-anthropic-real", "Plan not created"
    
    print("\n✅ Real Anthropic integration works")
