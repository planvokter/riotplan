# Create Plan Workflow

You are helping the user create a new plan with AI-generated, actionable steps for a complex task or feature.

## Your Task

Follow this workflow to create a comprehensive plan using the riotplan MCP tools available to you.

## Step 1: Review Provided Information

Check what information has already been provided as prompt arguments:
- **code**: ${code}
- **description**: ${description}
- **projectId**: ${projectId}
- **steps**: ${steps}

## Step 2: Gather Missing Information

For any information marked as "[code]", "[description]", "[project-id]", or "[steps]", ask the user to provide it:

1. **Plan Code** (if missing) - Ask for a short identifier (e.g., "auth-system", "dark-mode", "refactor-db")
2. **Plan Description** (if missing) - Ask for a clear, detailed description of what they want to accomplish
3. **Project ID** (if missing) - Ask which project this plan belongs to (optional, e.g., "kjerneverk")
4. **Number of Steps** (if missing) - Ask how many steps to generate, or let the AI determine automatically
5. **AI Provider** (optional) - Which provider to use (anthropic, openai, gemini). Default to anthropic if not specified.

## Step 3: Create the Plan Using MCP Tools

IMPORTANT: Use the `riotplan_plan` MCP tool to create the plan. DO NOT shell out to CLI commands.

Once you have all required information (code and description), call the `riotplan_plan` tool:

```
{
  "code": "the-plan-code",
  "name": "Human Readable Name (optional)",
  "description": "Detailed description of what to accomplish",
  "projectId": "kjerneverk",
  "steps": 8,
  "provider": "anthropic",
  "direct": false
}
```

Parameters:
- `code` (required) - Plan identifier
- `description` (required) - What to accomplish
- `name` (optional) - Human-readable name
- `projectId` (optional) - Project identifier
- `steps` (optional) - Number of steps to generate
- `direct` (optional) - Set to true to skip analysis phase
- `provider` (optional) - AI provider (anthropic, openai, gemini)
- `model` (optional) - Specific model to use
- `noAi` (optional) - Use templates only, no AI generation

## Step 4: Review the Generated Plan

After creation, use the returned `planId` with `riotplan_status`:

```
{
  "planId": "new-plan-id",
  "verbose": true
}
```

Inform the user about:
- The plan location
- Number of steps generated
- The plan structure (SUMMARY.md, EXECUTION_PLAN.md, step files)

## Step 5: Validate the Plan

Use the `riotplan_validate` tool to ensure the plan structure is correct:

```
{
  "planId": "new-plan-id"
}
```

If validation fails, report the issues to the user.

## Step 6: Prepare for Execution

Inform the user that they can:
- Review the generated plan files
- Start the first step using `riotplan_step` with `action: "start"`
- Track progress using `riotplan_status`
- Add or modify steps as needed

## Important Guidelines

- **Always use MCP tools** - Never shell out to CLI commands like `riotplan create`
- **Use plan/project identifiers** - Don't require filesystem paths from the client
- **Be specific** - Encourage detailed descriptions for better plan generation
- **Right-size steps** - Suggest 5-10 steps for most tasks
- **Use analysis** - Don't set `direct: true` unless the user specifically requests it
- **Validate** - Always validate the plan after creation

## Example Interaction

User: "I want to build a dog behavior tracking system"

You should:
1. Ask clarifying questions:
   - "What specific features should the system include?"
   - "Which project should this plan be associated with? (optional)"
   - "How many steps would you like? I recommend 8-10 for a system like this."

2. Once you have the information, call `riotplan_plan`:
   ```
   {
     "code": "dog-tracker",
     "name": "Dog Behavior and Training Tracking System",
     "description": "Build a comprehensive dog behavior and training tracking system. The system should allow users to log daily behaviors, track training sessions, monitor progress over time, set training goals, and generate insights about patterns. Include features for multiple dogs, behavior categorization, training exercises library, progress visualization, and reporting capabilities.",
     "projectId": "kjerneverk",
     "steps": 10,
     "provider": "anthropic"
   }
   ```

3. Review the result with `riotplan_status`

4. Validate with `riotplan_validate`

5. Inform the user the plan is ready and they can begin execution
