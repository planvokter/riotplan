# Creating Plans

Learn how to create RiotPlan plans using the CLI with AI-powered generation or template-based scaffolding.

## Quick Start

```bash
# Create a plan with AI generation
riotplan create my-feature

# Create with direct generation (skip analysis)
riotplan create my-feature --direct

# Create with templates only (no AI)
riotplan create my-feature --no-ai
```

## Interactive Creation (Recommended)

The `create` command provides a guided workflow:

```bash
riotplan create user-auth
```

### The Create Flow

1. **Description** - Opens your editor to describe what you want to accomplish
2. **Mode Selection** - Choose analysis-first or direct generation
3. **AI Generation** - Creates detailed, actionable plan content
4. **Validation** - Checks plan structure
5. **Next Steps** - Guidance on what to do next

### Example Session

```bash
$ riotplan create user-auth

Opening editor for plan description...
# (Editor opens, you write your requirements)

Plan description saved.

Choose generation mode:
  1. Analysis first (recommended for complex plans)
  2. Direct generation (faster for simple plans)

Selection: 1

Analyzing requirements...
✓ Analysis complete

Review analysis/REQUIREMENTS.md and provide feedback:
  riotplan elaborate ./user-auth

Or mark analysis ready and generate:
  riotplan analysis ready ./user-auth
  riotplan generate ./user-auth
```

## Generation Modes

### Analysis-First Mode (Recommended)

For complex plans, use analysis mode to refine requirements:

```bash
riotplan create complex-feature --analyze
```

This creates an `analysis/` directory with:
- `REQUIREMENTS.md` - Elaborated requirements
- `prompts/` - Saved elaboration feedback

#### Elaboration Workflow

```bash
# Provide feedback on analysis
riotplan elaborate ./complex-feature

# Or provide quick feedback inline
riotplan elaborate ./complex-feature -m "Add security requirements"

# Mark analysis ready when satisfied
riotplan analysis ready ./complex-feature

# Generate the plan
riotplan generate ./complex-feature
```

**Benefits:**
- Refine requirements iteratively
- Catch scope issues early
- More detailed, accurate plans
- Better for complex or ambiguous tasks

### Direct Mode

For straightforward plans, skip analysis:

```bash
riotplan create simple-fix --direct
```

This generates the plan immediately from your description.

**Benefits:**
- Faster plan creation
- Good for well-defined tasks
- Less overhead
- Immediate results

## AI-Powered Generation

### Setup

Install an AI provider:

```bash
# Anthropic Claude (recommended)
npm install @kjerneverk/execution-anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# OpenAI GPT
npm install @kjerneverk/execution-openai
export OPENAI_API_KEY="sk-..."

# Google Gemini
npm install @kjerneverk/execution-gemini
export GOOGLE_API_KEY="..."
```

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

### Provider Options

```bash
# Specify provider
riotplan create my-plan --provider anthropic

# Specify model
riotplan create my-plan --model claude-sonnet-4-5

# Control number of steps
riotplan create my-plan --steps 7
```

## Template-Based Generation

Without AI, RiotPlan uses templates:

```bash
riotplan create my-plan --no-ai
```

Creates template files with placeholders:

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

## Quick Scaffolding

For programmatic use or quick scaffolding:

```bash
# Create basic structure
riotplan init my-feature

# With description
riotplan init my-feature --description "Implement user authentication"

# With specific number of steps
riotplan init my-feature --steps 5

# In specific location
riotplan init my-feature --path ./prompts/
```

`init` creates the directory structure but doesn't generate detailed content.

## Amending Plans

After generation, use `amend` for structural feedback:

```bash
# Interactive amendment
riotplan amend ./my-feature

# Quick feedback
riotplan amend ./my-feature -m "Step 03 should come before 02"

# Amend specific step
riotplan amend ./my-feature -s 02 -m "Add more detail about testing"
```

Amendments are saved to `amendments/` directory.

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

### "No AI providers installed"

```bash
npm install @kjerneverk/execution-anthropic
```

### "No API key found"

```bash
export ANTHROPIC_API_KEY="your-key"
```

### AI generation fails

- Check API key is valid
- Verify network connectivity
- Check provider package is installed
- System automatically falls back to templates

### Plan already exists

```bash
# Use a different name
riotplan create my-feature-v2

# Or remove existing plan
rm -rf my-feature
riotplan create my-feature
```

## Programmatic Creation

```typescript
import { createPlan } from '@planvokter/riotplan';

const plan = await createPlan({
  code: 'user-auth',
  name: 'User Authentication',
  path: './prompts/user-auth',
  description: 'Implement secure user authentication',
  steps: [
    { title: 'Requirements Analysis', description: 'Gather requirements' },
    { title: 'Security Design', description: 'Design auth flow' },
    { title: 'Implementation', description: 'Build the system' },
    { title: 'Testing', description: 'Verify security' },
    { title: 'Documentation', description: 'Document the system' }
  ]
});
```

## Next Steps

- Learn about [Managing Steps](managing-steps) - Working with plan steps
- Explore [CLI Usage](cli-usage) - Complete command reference
- Read [Plan Structure](plan-structure) - Understanding plan anatomy
- Understand [Programmatic Usage](programmatic-usage) - Using the API
