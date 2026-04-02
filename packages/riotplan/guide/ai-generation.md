# AI-Powered Plan Generation

`riotplan` uses AI to generate detailed, actionable plans from your descriptions instead of generic templates.

## Quick Start

```bash
# 1. Install a provider
npm install @kjerneverk/execution-anthropic

# 2. Set API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Create a plan
riotplan create my-feature
```

## How It Works

When you run `riotplan create`:

1. You describe what you want to accomplish (opens editor)
2. Choose analysis-first or direct generation
3. AI analyzes your description and generates:
   - Executive summary explaining the approach
   - Detailed step-by-step execution plan
   - Specific tasks for each step
   - Concrete acceptance criteria
   - Testing strategies
   - Expected file changes

## Example Output

### Your Input
```
Create a REST API for managing a todo list with Node.js and Express.
```

### AI-Generated Plan

**SUMMARY.md**:
```markdown
## Executive Summary

This execution plan outlines the development of a REST API for managing 
a todo list application using Node.js and Express. The project will be 
delivered in three focused steps that progressively build out the 
functionality from initial setup through core CRUD operations to 
production-ready features...
```

**Step 01**:
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

## Acceptance Criteria
- [ ] package.json exists with express listed as dependency
- [ ] Running 'npm start' successfully starts the server
- [ ] Server responds to GET / with 200 status code
- [ ] Health check endpoint returns status
```

## Providers

### Anthropic Claude (Recommended)
```bash
npm install @kjerneverk/execution-anthropic
export ANTHROPIC_API_KEY="sk-ant-..."
riotplan create my-plan --provider anthropic
```

### OpenAI GPT
```bash
npm install @kjerneverk/execution-openai
export OPENAI_API_KEY="sk-..."
riotplan create my-plan --provider openai
```

### Google Gemini
```bash
npm install @kjerneverk/execution-gemini
export GOOGLE_API_KEY="..."
riotplan create my-plan --provider gemini
```

## Options

```bash
# Specify provider
riotplan create my-plan --provider anthropic

# Specify model
riotplan create my-plan --model claude-sonnet-4-5

# Control number of steps
riotplan create my-plan --steps 7

# Skip AI, use templates
riotplan create my-plan --no-ai

# Direct generation (skip analysis)
riotplan create my-plan --direct
```

## Fallback Behavior

If no AI provider is available:
- Automatically falls back to template generation
- Shows helpful installation message
- Creates template files you can fill in manually

You can also explicitly use templates:
```bash
riotplan create my-plan --no-ai
```

## Troubleshooting

**"No AI providers installed"**
```bash
npm install @kjerneverk/execution-anthropic
```

**"No API key found"**
```bash
export ANTHROPIC_API_KEY="your-key"
```

**AI generation fails**
- Check API key is valid
- Verify network connectivity
- Check provider package is installed
- System automatically falls back to templates

## Technical Details

### Structured Output
Uses JSON schema for reliable, parseable responses from the AI.

### Dynamic Loading
Providers are loaded at runtime, not build time. This keeps the package lightweight.

### Type Safety
Full TypeScript support with proper type declarations for all providers.

### Graceful Degradation
Always falls back to templates if AI is unavailable. Never fails due to missing AI.
