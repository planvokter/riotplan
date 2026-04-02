# MCP Elicitation Notes

## Understanding MCP Elicitation

### What It Is

MCP elicitation (introduced in the 2025-06-18 specification) is a protocol feature that allows **servers** to request structured data from users dynamically during interactions. It uses JSON schemas to validate responses and enables interactive workflows.

### How It Works

Servers send `elicitation/create` requests to clients:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "elicitation/create",
  "params": {
    "message": "Please provide your GitHub username",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "name": { "type": "string" }
      },
      "required": ["name"]
    }
  }
}
```

Clients respond with:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "action": "accept",
    "content": { "name": "octocat" }
  }
}
```

### Key Limitation for Prompts

**Prompts cannot directly trigger elicitation requests.** Prompts are static text templates that return messages to inject into the conversation. They don't have the ability to make protocol-level requests.

Only **tools** and **resources** can trigger elicitation by making `elicitation/create` requests during their execution.

## Our Approach: Prompt Arguments + Model Instructions

Since prompts can't trigger elicitation directly, we use a hybrid approach:

### 1. Define Prompt Arguments

```typescript
{
    name: 'create_plan',
    description: 'Create a new plan with AI-generated steps for a complex task',
    arguments: [
        {
            name: 'code',
            description: 'Plan code/identifier',
            required: false,
        },
        {
            name: 'description',
            description: 'Detailed description of what to accomplish',
            required: false,
        },
        {
            name: 'directory',
            description: 'Parent directory where the plan should be created',
            required: false,
        },
    ],
}
```

### 2. Template Variable Substitution

The prompt template uses `${code}`, `${description}`, etc.:

```markdown
## Step 1: Review Provided Information

Check what information has already been provided:
- **code**: ${code}
- **description**: ${description}
- **directory**: ${directory}
```

When arguments are missing, we substitute with markers like `[code]`, `[description]`:

```typescript
if (!filledArgs.code) filledArgs.code = '[code]';
if (!filledArgs.description) filledArgs.description = '[description]';
```

### 3. Model Instructions

The prompt explicitly tells the model to check for these markers:

```markdown
## Step 2: Gather Missing Information

For any information marked as "[code]", "[description]", "[directory]", 
ask the user to provide it:

1. **Plan Code** (if missing) - Ask for a short identifier
2. **Plan Description** (if missing) - Ask for a detailed description
3. **Target Directory** (if missing) - Ask where to create the plan
```

## Benefits of This Approach

### Client-Side Elicitation (Future)

MCP clients could potentially:
1. See that `create_plan` has arguments
2. Elicit those arguments from the user BEFORE invoking the prompt
3. Pass the collected values when calling the prompt

This would provide a form-based UI for gathering information upfront.

### Model-Side Fallback (Current)

If the client doesn't elicit arguments:
1. The prompt is invoked with missing arguments
2. Template substitution marks them as `[code]`, `[description]`, etc.
3. The model sees these markers and knows to ask the user
4. The model uses natural language to gather information

### Progressive Enhancement

- Works today with explicit model instructions
- Can be enhanced in the future if clients add argument elicitation
- Provides clear structure for what information is needed

## Alternative: Tool-Based Elicitation

Another approach would be to create a tool that triggers elicitation:

```typescript
{
    name: 'riotplan_elicit_plan_info',
    description: 'Gather plan information from user',
    inputSchema: {
        type: 'object',
        properties: {}
    }
}

async function executeElicitPlanInfo(args, context) {
    // Make elicitation/create request
    const result = await context.elicit({
        message: "Please provide plan information",
        requestedSchema: {
            type: "object",
            properties: {
                code: { type: "string", description: "Plan code" },
                description: { type: "string", description: "What to accomplish" },
                directory: { type: "string", description: "Where to create plan" }
            },
            required: ["code", "description"]
        }
    });
    
    return result;
}
```

However, this has drawbacks:
- Requires the model to know to call this tool
- Adds an extra step (call tool, then call create)
- Less integrated with the prompt workflow

## Recommendation

The **prompt arguments + model instructions** approach is the best solution because:

1. **Works today** - Model instructions ensure it works immediately
2. **Future-proof** - Can be enhanced if clients add argument elicitation
3. **Clear structure** - Arguments document what's needed
4. **Flexible** - Users can provide info upfront OR be prompted
5. **Natural** - Model asks in conversational way, not just forms

## Implementation Status

✅ Added prompt arguments to `create_plan`
✅ Added template variable substitution
✅ Added explicit model instructions
✅ Rebuilt MCP server with changes
⏳ Waiting for client support for argument elicitation (future enhancement)

## Testing

To test the current implementation:

1. Invoke `create_plan` prompt without arguments
2. Model should see `[code]`, `[description]`, `[directory]` markers
3. Model should ask user for missing information
4. Model should use `riotplan_create` tool with collected info

To test future client elicitation (when supported):

1. Client sees `create_plan` has arguments
2. Client shows form to collect: code, description, directory
3. Client invokes prompt with collected values
4. Model sees actual values, not markers
5. Model proceeds directly to creating the plan
