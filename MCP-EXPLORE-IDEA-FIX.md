# Fix: explore_idea Command UX Issue

## Problem

The `explore_idea` MCP prompt had a workflow mismatch that created a confusing user experience:

1. User invokes the prompt (via MCP or Cursor command)
2. AI would immediately stop and ask for structured input:
   - "Please provide a code/identifier"
   - "Please provide an initial description"
3. User had to provide these in a second interaction
4. Only then would the AI create the idea and begin exploration

This created a jarring, form-filling experience instead of a natural conversational flow.

## Root Cause

The MCP prompt file (`src/mcp/prompts/explore_idea.md`) had outdated instructions that told the AI to:
1. Ask the user for code and description
2. Wait for response
3. Then create the idea

Meanwhile, the Cursor command version (`.cursor/commands/explore_idea.md`) had already been updated with smart extraction logic.

## Solution

Updated the MCP prompt to match the improved Cursor command version with smart extraction:

### Key Changes

1. **Smart Extraction First**: AI now checks if the user already provided code/description in their message
2. **Derive Missing Info**: If description is provided but code is missing, AI derives a kebab-case code from the description
3. **Natural Fallback**: Only asks for missing information if truly needed
4. **Immediate Creation**: Creates the idea as soon as it has the required info
5. **Start Exploration**: Begins the exploration conversation immediately after creation

### Updated Workflow

```
1. Extract or Gather Idea Details
   - Check user's message for code and description
   - Extract if present
   - Derive code from description if only description provided
   - Only ask if both are missing

2. Create the Idea
   - Call riotplan_idea_create immediately with extracted/derived values

3. Begin Exploration
   - Start asking open-ended questions immediately
   - Don't wait for further prompting
```

### Example Flows

**Before Fix:**
```
User: /riotplan/explore_idea
AI: "Please provide: 1. A short code/identifier 2. Initial description"
User: "Ugh, okay... code is 'my-feature', description is 'Add feature X'"
AI: *calls riotplan_idea_create*
AI: "What's driving this?"
```

**After Fix - Full Info:**
```
User: /riotplan/explore_idea real-time-notifications Add push notifications
AI: *extracts code="real-time-notifications", description="Add push notifications"*
AI: *calls riotplan_idea_create immediately*
AI: "Let's explore this idea. What's driving the need for push notifications?"
```

**After Fix - Partial Info:**
```
User: /riotplan/explore_idea I want to add notifications
AI: *derives code="add-notifications", description="I want to add notifications"*
AI: *calls riotplan_idea_create immediately*
AI: "Let's explore this notification idea. What's driving this?"
```

**After Fix - No Info:**
```
User: /riotplan/explore_idea
AI: "What idea would you like to explore? Give me a short name and brief description."
User: "I'm thinking about real-time notifications"
AI: *extracts and creates immediately*
AI: "Great! Let's explore this. What's driving the need?"
```

## Files Changed

- `/Users/tobrien/gitw/planvokter/riotplan/src/mcp/prompts/explore_idea.md`
  - Updated workflow section with smart extraction logic
  - Added detailed examples showing extraction patterns
  - Added anti-pattern: "Don't ask for information the user already provided"
  - Added principle: "Smart Extraction: Use information the user already provided"

## Testing

- All existing tests pass (623 tests, 92.84% coverage)
- No breaking changes to MCP tool schemas
- Backward compatible with all existing workflows

## Benefits

1. **Better UX**: Natural conversational flow instead of form-filling
2. **Fewer Steps**: Reduces interaction from 2-3 messages to 1
3. **Smarter AI**: AI extracts and derives information intelligently
4. **Consistent**: MCP prompt now matches Cursor command behavior
5. **Flexible**: Still supports all three scenarios (full info, partial info, no info)

## Related Work

The Cursor command version (`.cursor/commands/explore_idea.md`) already had this smart extraction logic. This fix brings the MCP prompt in sync with that improved version.

## Future Considerations

This pattern could be applied to other interactive prompts/commands that currently ask for structured input upfront. Candidates to review:
- `checkpoint_create` (asks for name and message)
- Any other prompts that immediately request structured data

The key insight: **Extract first, ask later**. If the user has already provided information in their message, use it instead of asking them to repeat it.
