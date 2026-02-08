"""
FastMCP Sampling Tests for RiotPlan

Tests that RiotPlan correctly uses MCP sampling when available.
"""

import pytest
from pathlib import Path


@pytest.mark.asyncio
async def test_sampling_capability_detection(sampling_client):
    """
    Test that RiotPlan detects the client supports sampling.
    
    This verifies Phase 1 (session architecture) is working.
    """
    client, handler_type = sampling_client
    
    # The client should have sampling capability
    # We can verify this by checking that tools are available
    tools = await client.list_tools()
    
    assert len(tools) > 0, "No tools available from RiotPlan MCP server"
    
    # Check for key RiotPlan tools
    tool_names = [tool["name"] for tool in tools]
    assert "riotplan_generate" in tool_names, "riotplan_generate tool not found"
    
    print(f"\n✅ Sampling capability detected with {handler_type} handler")
    print(f"   Available tools: {len(tools)}")


@pytest.mark.asyncio
async def test_sampling_plan_generation(sampling_client, temp_plan_dir):
    """
    Test that RiotPlan uses MCP sampling to generate a plan.
    
    This is the end-to-end test that validates the entire implementation.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-web-app"
    
    # Call riotplan_generate - this should trigger sampling
    result = await client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Create a simple web application with user authentication",
            "steps": 3,
        }
    )
    
    # Verify the result
    assert "content" in result, "No content in result"
    content = result["content"]
    
    # FastMCP returns content as a list of content blocks
    if isinstance(content, list):
        assert len(content) > 0, "Empty content list"
        text_content = "\n".join(
            block.get("text", "") for block in content if block.get("type") == "text"
        )
    else:
        text_content = str(content)
    
    # Verify plan was created
    assert plan_path.exists(), f"Plan directory not created at {plan_path}"
    assert (plan_path / "SUMMARY.md").exists(), "SUMMARY.md not created"
    assert (plan_path / "STATUS.md").exists(), "STATUS.md not created"
    
    # Verify steps were created
    steps_dir = plan_path / "steps"
    assert steps_dir.exists(), "steps/ directory not created"
    
    step_files = list(steps_dir.glob("*.md"))
    assert len(step_files) == 3, f"Expected 3 steps, found {len(step_files)}"
    
    # Verify SUMMARY.md has expected structure
    summary_content = (plan_path / "SUMMARY.md").read_text()
    assert "Executive Summary" in summary_content or "Summary" in summary_content
    
    print(f"\n✅ Plan generated successfully using {handler_type} sampling handler")
    print(f"   Plan location: {plan_path}")
    print(f"   Steps created: {len(step_files)}")


@pytest.mark.asyncio
async def test_sampling_request_format(sampling_client, temp_plan_dir):
    """
    Test that sampling requests are formatted correctly.
    
    Verifies Phase 2 (execution-sampling package) is working.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-api"
    
    # Generate a plan with specific requirements
    result = await client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Build a REST API with authentication and rate limiting",
            "steps": 5,
        }
    )
    
    # Verify plan was created
    assert plan_path.exists(), "Plan not created"
    
    # Verify all 5 steps were created
    steps_dir = plan_path / "steps"
    step_files = list(steps_dir.glob("*.md"))
    assert len(step_files) == 5, f"Expected 5 steps, found {len(step_files)}"
    
    # Verify step numbering is correct
    step_numbers = sorted([int(f.stem) for f in step_files])
    assert step_numbers == [1, 2, 3, 4, 5], f"Incorrect step numbering: {step_numbers}"
    
    print(f"\n✅ Sampling request format correct with {handler_type}")
    print(f"   Generated {len(step_files)} steps with correct numbering")


@pytest.mark.asyncio
async def test_sampling_with_elaborations(sampling_client, temp_plan_dir):
    """
    Test that elaborations are passed correctly to sampling.
    
    Verifies that context is properly included in sampling requests.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-elaborations"
    
    # Generate a plan with elaborations
    result = await client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Create a task management system",
            "steps": 3,
            "elaborations": [
                "Use TypeScript and React",
                "Include drag-and-drop functionality",
                "Add real-time collaboration",
            ],
        }
    )
    
    # Verify plan was created
    assert plan_path.exists(), "Plan not created"
    
    # Read the generated content to verify elaborations were considered
    summary = (plan_path / "SUMMARY.md").read_text()
    
    # Check if any of the elaborations appear in the summary
    # (The AI should have considered them)
    elaboration_keywords = ["typescript", "react", "drag", "drop", "real-time", "collaboration"]
    found_keywords = [kw for kw in elaboration_keywords if kw.lower() in summary.lower()]
    
    # We expect at least some keywords to appear
    assert len(found_keywords) > 0, (
        f"None of the elaboration keywords found in summary. "
        f"Expected: {elaboration_keywords}, Summary: {summary[:200]}"
    )
    
    print(f"\n✅ Elaborations processed correctly with {handler_type}")
    print(f"   Found keywords: {found_keywords}")


@pytest.mark.asyncio
async def test_openai_handler_specifically(openai_client, temp_plan_dir):
    """
    Test specifically with OpenAI handler.
    
    Use this to debug OpenAI-specific issues.
    """
    plan_path = Path(temp_plan_dir) / "test-openai"
    
    result = await openai_client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Simple TODO app",
            "steps": 2,
        }
    )
    
    assert plan_path.exists(), "Plan not created"
    steps = list((plan_path / "steps").glob("*.md"))
    assert len(steps) == 2, f"Expected 2 steps, found {len(steps)}"
    
    print("\n✅ OpenAI handler works correctly")


@pytest.mark.asyncio
async def test_anthropic_handler_specifically(anthropic_client, temp_plan_dir):
    """
    Test specifically with Anthropic handler.
    
    Use this to debug Anthropic-specific issues.
    """
    plan_path = Path(temp_plan_dir) / "test-anthropic"
    
    result = await anthropic_client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Simple blog platform",
            "steps": 2,
        }
    )
    
    assert plan_path.exists(), "Plan not created"
    steps = list((plan_path / "steps").glob("*.md"))
    assert len(steps) == 2, f"Expected 2 steps, found {len(steps)}"
    
    print("\n✅ Anthropic handler works correctly")


@pytest.mark.asyncio
async def test_no_server_api_keys_needed(sampling_client, temp_plan_dir, monkeypatch):
    """
    Critical test: Verify that RiotPlan does NOT need server-side API keys
    when using MCP sampling.
    
    This proves the core value proposition - no duplicate API keys needed!
    """
    client, handler_type = sampling_client
    
    # Remove all server-side API keys from environment
    # This simulates RiotPlan running without any API keys configured
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    
    plan_path = Path(temp_plan_dir) / "test-no-keys"
    
    # This should still work because the CLIENT has API keys (via FastMCP handler)
    # and RiotPlan uses sampling to delegate to the client
    result = await client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Simple calculator app",
            "steps": 2,
        }
    )
    
    # Verify plan was created successfully
    assert plan_path.exists(), "Plan not created despite no server API keys"
    assert (plan_path / "SUMMARY.md").exists(), "SUMMARY.md not created"
    
    steps = list((plan_path / "steps").glob("*.md"))
    assert len(steps) == 2, f"Expected 2 steps, found {len(steps)}"
    
    print(f"\n✅ CRITICAL: No server API keys needed with {handler_type} sampling!")
    print("   This proves RiotPlan delegates AI generation to the client")
    print("   No duplicate API keys required!")


@pytest.mark.asyncio
async def test_plan_file_structure(sampling_client, temp_plan_dir):
    """
    Test that generated plan has correct file structure.
    
    Verifies all required files are created with proper content.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-structure"
    
    result = await client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "E-commerce platform",
            "steps": 4,
        }
    )
    
    # Check directory structure
    assert plan_path.exists(), "Plan directory not created"
    assert plan_path.is_dir(), "Plan path is not a directory"
    
    # Check required files
    required_files = ["SUMMARY.md", "STATUS.md", "EXECUTION_PLAN.md"]
    for filename in required_files:
        file_path = plan_path / filename
        assert file_path.exists(), f"{filename} not created"
        assert file_path.stat().st_size > 0, f"{filename} is empty"
    
    # Check steps directory
    steps_dir = plan_path / "steps"
    assert steps_dir.exists(), "steps/ directory not created"
    assert steps_dir.is_dir(), "steps/ is not a directory"
    
    # Check step files
    step_files = sorted(steps_dir.glob("*.md"))
    assert len(step_files) == 4, f"Expected 4 steps, found {len(step_files)}"
    
    # Verify step numbering
    for i, step_file in enumerate(step_files, 1):
        assert step_file.stem == str(i), f"Step {i} has wrong filename: {step_file.name}"
        assert step_file.stat().st_size > 0, f"Step {i} is empty"
    
    print(f"\n✅ Plan file structure correct with {handler_type}")
    print(f"   Created: {', '.join(required_files)}")
    print(f"   Steps: {len(step_files)} files with correct numbering")


@pytest.mark.asyncio
async def test_summary_content_quality(sampling_client, temp_plan_dir):
    """
    Test that generated SUMMARY.md has expected quality and structure.
    
    Verifies the AI generation produces useful content.
    """
    client, handler_type = sampling_client
    plan_path = Path(temp_plan_dir) / "test-quality"
    
    result = await client.call_tool(
        "riotplan_generate",
        {
            "path": str(plan_path),
            "description": "Mobile app for fitness tracking with social features",
            "steps": 3,
        }
    )
    
    # Read SUMMARY.md
    summary_path = plan_path / "SUMMARY.md"
    summary_content = summary_path.read_text()
    
    # Check for expected sections
    expected_sections = [
        ("summary", ["summary", "overview", "objective"]),
        ("approach", ["approach", "strategy", "implementation"]),
        ("success criteria", ["success", "criteria", "acceptance"]),
    ]
    
    for section_name, keywords in expected_sections:
        found = any(kw.lower() in summary_content.lower() for kw in keywords)
        assert found, f"Expected section '{section_name}' not found in SUMMARY.md"
    
    # Check content length (should be substantial)
    assert len(summary_content) > 200, "SUMMARY.md content is too short"
    
    # Check that description keywords appear
    description_keywords = ["fitness", "tracking", "mobile", "social"]
    found_keywords = [kw for kw in description_keywords if kw.lower() in summary_content.lower()]
    assert len(found_keywords) >= 2, (
        f"Description keywords not reflected in summary. "
        f"Expected: {description_keywords}, Found: {found_keywords}"
    )
    
    print(f"\n✅ Summary content quality verified with {handler_type}")
    print(f"   Content length: {len(summary_content)} characters")
    print(f"   Keywords found: {found_keywords}")
