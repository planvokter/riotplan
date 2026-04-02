# MCP Prompt Fixes

## Problem Summary

The MCP prompts in riotplan were written as user documentation rather than as instructions to the AI model. This caused the model to:

1. **Shell out to CLI commands** instead of using MCP tools
2. **Not ask about directory placement** for plans
3. **Treat prompts as documentation** rather than workflow instructions

## Root Cause

The prompt markdown files (`create_plan.md`, `execute_step.md`, `track_progress.md`) were structured as:
- User-facing documentation explaining how to use the tools
- Examples showing CLI commands and tool calls
- Tips and best practices for users

When these prompts were invoked by the model, it interpreted them as documentation to reference rather than instructions to follow.

## Solution

Rewrote all three prompt files to be **instructions TO the model** rather than documentation FOR users:

### Key Changes

1. **Direct Instructions**: Changed from "Users should..." to "You should..."
2. **Explicit Tool Usage**: Added clear instructions to use MCP tools, not shell commands
3. **Step-by-Step Workflows**: Provided explicit steps the model should follow
4. **Directory Guidance**: Added explicit step to ask user about directory placement
5. **Clear Examples**: Showed the model exactly what tool calls to make

### Files Modified

#### `src/mcp/prompts/create_plan.md`

**Before:**
```markdown
## Workflow Steps

1. **Define Plan Details**
   - Choose a plan code (short identifier, e.g., "auth-system")
   - Write a clear, detailed description of what you want to accomplish
```

**After:**
```markdown
## Step 1: Gather Information

First, ask the user for the following information if not already provided:

1. **Plan Code** - A short identifier (e.g., "auth-system", "dark-mode", "refactor-db")
2. **Plan Description** - A clear, detailed description of what they want to accomplish
3. **Target Directory** - Where to create the plan. Suggest using a `plans/` directory if one exists, or ask if they want to create one. Default to current directory if they don't specify.
```

Key additions:
- Explicit instruction to ask about directory
- Clear guidance on what to suggest
- Direct instructions to use `riotplan_create` MCP tool

#### `src/mcp/prompts/execute_step.md`

**Before:**
```markdown
## Workflow Steps

1. **Check Plan Status**
   - Run `riotplan_status` to see current state
   - Verify prerequisites are met
```

**After:**
```markdown
## Step 1: Check Plan Status

Use the `riotplan_status` tool to check the current plan state:

```
{
  "path": "${path}",
  "verbose": false
}
```

This will show you:
- Current step number
- Progress percentage
```

Key changes:
- Direct instructions on which tool to call
- Exact parameter format
- Clear explanation of what the tool returns

#### `src/mcp/prompts/track_progress.md`

Similar transformation from documentation to instructions.

## Important Guidelines Added

All prompts now include:

```markdown
## Important Guidelines

- **Always use MCP tools** - Never shell out to CLI commands
- **Ask about directory** - Don't assume where the plan should be created
- **Be specific** - Encourage detailed descriptions for better plan generation
```

## Testing

After rebuilding with `npm run build`, the updated prompts are now available in:
- `dist/mcp/prompts/create_plan.md`
- `dist/mcp/prompts/execute_step.md`
- `dist/mcp/prompts/track_progress.md`

The MCP server loads these files at runtime and sends them to the model when a prompt is invoked.

## Expected Behavior

When a user invokes the `create_plan` prompt, the model should now:

1. Ask the user for plan details including directory placement
2. Suggest using a `plans/` directory
3. Use the `riotplan_create` MCP tool (not shell commands)
4. Follow up with `riotplan_status` and `riotplan_validate` tools
5. Inform the user the plan is ready for execution

## Elicitation Support (Added)

After the initial fixes, I added support for MCP prompt arguments to enable better parameter gathering:

### What is MCP Elicitation?

MCP elicitation is a protocol feature that allows servers to request structured data from users dynamically. However, **prompts themselves cannot directly trigger elicitation** - they're static text templates.

### Our Approach

Instead of trying to make prompts trigger elicitation (which isn't possible), we:

1. **Added prompt arguments** to `create_plan`:
   - `code` - Plan identifier
   - `description` - What to accomplish
   - `directory` - Where to create the plan
   - `steps` - Number of steps (optional)

2. **Template variable substitution**: The prompt template uses `${code}`, `${description}`, etc., which get replaced with either:
   - The provided argument value, OR
   - `[code]`, `[description]`, etc. if missing

3. **Explicit instructions**: The prompt tells the model to check for `[code]`, `[description]`, etc. markers and ask the user for missing information.

### Benefits

- **Client-side elicitation**: MCP clients (like Cursor) can see the prompt arguments and potentially elicit them before invoking the prompt
- **Model-side fallback**: If arguments aren't provided, the model sees `[code]` markers and knows to ask the user
- **Better UX**: Users can provide information upfront OR be prompted for it

### Code Changes

#### `src/mcp/prompts/index.ts`

Added arguments to the `create_plan` prompt definition:

```typescript
{
    name: 'create_plan',
    description: 'Create a new plan with AI-generated steps for a complex task',
    arguments: [
        {
            name: 'code',
            description: 'Plan code/identifier (e.g., "auth-system", "dark-mode")',
            required: false,
        },
        // ... more arguments
    ],
}
```

Updated `getPrompt()` to mark missing arguments with `[code]`, `[description]`, etc.

#### `src/mcp/prompts/create_plan.md`

Added Step 1 to review provided information:

```markdown
## Step 1: Review Provided Information

Check what information has already been provided as prompt arguments:
- **code**: ${code}
- **description**: ${description}
- **directory**: ${directory}
- **steps**: ${steps}

## Step 2: Gather Missing Information

For any information marked as "[code]", "[description]", "[directory]", or "[steps]", ask the user to provide it:
```

## Next Steps

1. Test the updated prompts with Cursor
2. Verify the model now asks about directory placement
3. Verify the model uses MCP tools instead of shell commands
4. Test if Cursor's MCP client elicits prompt arguments before invoking the prompt
5. Consider adding similar explicit instructions to other MCP servers (riotdoc, riotprompt)
