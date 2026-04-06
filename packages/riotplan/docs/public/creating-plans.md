# Creating Plans

Learn how to create RiotPlan plans using MCP tools with AI-powered generation or template-based scaffolding.

## Quick Start

Ask your AI assistant to create a plan:

> "Create a plan called `user-auth` for implementing JWT-based authentication with 6 steps."

This calls the `riotplan_plan` MCP tool, which handles the full creation workflow.

## The Create Flow

When you ask your assistant to create a plan, the `riotplan_plan` tool:

1. **Takes your description** — You describe what you want to accomplish
2. **Generates plan content** — AI creates detailed, actionable plan files
3. **Validates structure** — Checks that all required files are present
4. **Returns guidance** — Tells you what was created and what to do next

## Generation Modes

### Analysis-First Mode (Recommended)

For complex plans, use analysis mode to refine requirements before generating:

> "Create a plan called `complex-feature` with analysis mode enabled."

This creates an `analysis/` directory with:
- `REQUIREMENTS.md` — Elaborated requirements
- `prompts/` — Saved elaboration feedback

You can then provide feedback on the analysis before generating the full plan.

**Benefits:**
- Refine requirements iteratively
- Catch scope issues early
- More detailed, accurate plans
- Better for complex or ambiguous tasks

### Direct Mode

For straightforward plans, skip analysis:

> "Create a plan called `simple-fix` with 4 steps, using direct generation."

This generates the plan immediately from your description.

**Benefits:**
- Faster plan creation
- Good for well-defined tasks
- Less overhead
- Immediate results

## AI-Powered Generation

### What AI Generates

With AI, you get:

**SUMMARY.md:**
- Executive summary explaining the approach
- Architectural decisions
- Key principles and philosophy
- Success metrics

**EXECUTION_PLAN.md:**
- Ordered sequence of steps
- Phase groupings
- Effort estimates
- Quality gates
- Commit strategy

**Step Files:**
- Specific tasks for each step
- Concrete acceptance criteria
- Testing strategies
- Verification commands
- Expected file changes

### Example AI Output

**Your Input:**
```
Create a REST API for managing a todo list with Node.js and Express.
Include CRUD operations, validation, and error handling.
```

**AI-Generated Step:**
```markdown
# Step 01: Project Initialization and Basic Server Setup

## Objective
Establish the project foundation with Node.js/Express setup, project
structure, and a basic working server that responds to requests

## Tasks

### 01.1 Initialize Node.js project with npm init
Create package.json with project metadata (name, version, description)

### 01.2 Install Express framework
Install Express and development dependencies including nodemon

### 01.3 Create project directory structure
Create src/ folder with server.js and app.js files

### 01.4 Implement basic Express server
Set up Express app with middleware and basic route

### 01.5 Add health check endpoint
Create GET /health endpoint returning status

## Acceptance Criteria
- [ ] package.json exists with express listed as dependency
- [ ] Running 'npm start' successfully starts the server
- [ ] Server responds to GET / with 200 status code
- [ ] Health check endpoint returns { status: 'ok' }
- [ ] Server logs startup message with port number

## Verification
```bash
npm install
npm start
curl http://localhost:3000/health
```
```

## Template-Based Generation

Without AI, RiotPlan uses templates. The `riotplan_plan` tool creates template files with placeholders:

```markdown
# Step 01: [Step Name]

## Goal
[What this step accomplishes]

## Prerequisites
- [What must be done before this step]

## Tasks

### Task 1: [Task Name]
[Detailed instructions]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Verification
```bash
# Commands to verify this step is complete
```
```

You fill in the placeholders manually.

## Amending Plans

After generation, you can provide structural feedback:

> "Add a security audit step after step 5 in the user-auth plan."

> "Step 03 should come before step 02 in the complex-feature plan."

Amendments are saved to the `amendments/` directory.

## Configuration

Create `.riotplanrc.json` in your plan directory:

```json
{
  "defaultProvider": "anthropic",
  "autoUpdateStatus": true,
  "stepTemplate": "detailed",
  "analysis": {
    "enabled": true,
    "directory": "analysis"
  }
}
```

## Best Practices

### Writing Good Descriptions

**Good:**
```
Implement user authentication with JWT tokens. Include:
- User registration with email verification
- Login with JWT access and refresh tokens
- Password reset via email
- Rate limiting on auth endpoints
- Session management
```

**Not as good:**
```
Add auth
```

**Tips:**
- Be specific about requirements
- Include technical constraints
- Mention non-functional requirements (security, performance)
- Specify what's out of scope

### Choosing Step Count

| Steps | Use Case |
|-------|----------|
| 3-5 | Simple features, bug fixes |
| 6-10 | Medium features, refactors |
| 11-15 | Complex features, migrations |
| 16+ | Large projects (consider breaking up) |

### Analysis vs Direct

| Use Analysis | Use Direct |
|--------------|------------|
| Complex requirements | Simple, well-defined tasks |
| Ambiguous scope | Clear scope |
| Multiple approaches | One obvious approach |
| High-stakes changes | Low-risk changes |
| Unfamiliar domain | Familiar patterns |

## Troubleshooting

### AI generation fails

- Check that your API key is set in the environment
- Verify network connectivity
- The system automatically falls back to templates if AI is unavailable

### Plan already exists

Ask your assistant to use a different plan code, or remove the existing plan directory first.

## Next Steps

- Learn about [Managing Steps](managing-steps) — Working with plan steps
- Read [Plan Structure](plan-structure) — Understanding plan anatomy
- Explore [MCP Tools](mcp-tools) — All available MCP tools
- Understand [Programmatic Usage](programmatic-usage) — Using the API
