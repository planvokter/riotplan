# RiotPlan

**A plan is bigger than a list of tasks.**

RiotPlan treats plans as **constructs**—full lifecycles from idea exploration through execution. Think before you execute. Support complex, multi-session workflows. Make your plans truly yours.

Part of [Kjerneverk](https://kjerneverk.github.io) - structured formats for working with generative AI.

**Now available as an MCP server!** Integrate with Cursor and other AI assistants - see [MCP Integration](#mcp-integration) below.

**✨ MCP Sampling Support** - No duplicate API keys needed when using RiotPlan via MCP! [Learn more →](docs/SAMPLING.md)

## Why RiotPlan?

### Before: Inadequate Planning

- **Tool-generated inadequacy**: Depending on AI tools to generate simplistic task lists
- **Markdown chaos**: Plans are markdown files that pile up without structure or lifecycle
- **Issue trackers without thinking**: Systems like Beads (Steve Yegge's git-backed tracker) address markdown problems but don't support deep, thoughtful planning
- **No analysis phase**: Jumping straight to execution without exploring ideas or comparing approaches

### After: Plans as Lifecycle

- **Standard lifecycle**: Idea exploration → Shaping approaches → Building detailed plan → Execution → Completion
- **Thinking before execution**: You can't just create a plan and execute it. RiotPlan supports analysis, elaboration, research.
- **Standard infrastructure**: MCP resources, tools, and prompts that know how to work with plans. Not just a format, but a system.
- **Tool independence**: Works from CLI with API keys, via MCP with any model, or through future GUI applications.

## What is a RiotPlan?

A **plan** is a construct that manages multi-step AI-assisted tasks:

- **Spans multiple sessions** - Work on a task over days or weeks
- **Has persistent state** - Track progress in STATUS.md
- **Organized into steps** - Numbered files (01-STEP.md, 02-STEP.md)
- **Can be interrupted and resumed** - Pick up where you left off
- **Supports deep thinking** - Idea exploration, approach comparison, analysis before action

## Plan Structure

```
my-plan/
├── my-plan-prompt.md     # Meta-prompt (prompt-of-prompts)
├── SUMMARY.md            # Overview of the approach
├── EXECUTION_PLAN.md     # Step-by-step strategy
├── STATUS.md             # Current state (auto-updated)
├── plan/                 # Step files
│   ├── 01-first-step.md
│   ├── 02-second-step.md
│   └── ...
└── analysis/             # Analysis output (optional)
```

### Key Files

| File | Purpose |
|------|---------|
| `{code}-prompt.md` | Initial meta-prompt that creates the plan |
| `SUMMARY.md` | High-level overview of the approach |
| `EXECUTION_PLAN.md` | Detailed execution strategy |
| `STATUS.md` | Current state, progress tracking |
| `01-*.md`, `02-*.md` | Individual step prompts |

## Real-World Examples

Plans in the wild:

```
grunnverk/prompts/
├── big-splitup/           # Codebase restructuring
├── commit-splitting/      # Feature implementation
├── parallel-execution/    # Complex feature with phases
├── shared-utils/          # Package extraction
└── ai-service/            # Service extraction
```

## Installation

```bash
npm install -g @riotprompt/riotplan
```

Or as a development dependency:

```bash
npm install --save-dev @riotprompt/riotplan
```

### AI-Powered Generation (Optional)

`riotplan` can use AI to generate detailed, actionable plans from your descriptions. Install an execution provider:

```bash
# For Anthropic Claude (recommended)
npm install @riotprompt/execution-anthropic

# For OpenAI GPT
npm install @riotprompt/execution-openai

# For Google Gemini
npm install @riotprompt/execution-gemini
```

Set your API key:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
```

Without an AI provider, `riotplan` falls back to template-based generation.

## Command-Line Interface

### Creating a Plan

Create a new plan with AI generation:

```bash
riotplan create my-feature
```

This will:
1. Prompt for your plan description (opens editor)
2. Ask if you want analysis first or direct generation
3. Use AI to generate detailed plan content
4. Create all plan files with actionable steps

Options:

```bash
riotplan create my-feature --direct           # Skip analysis, generate directly
riotplan create my-feature --steps 7          # Specify number of steps
riotplan create my-feature --provider anthropic  # Choose AI provider
riotplan create my-feature --model claude-sonnet-4-5  # Specify model
riotplan create my-feature --no-ai            # Use templates only
```

Creates:

```
my-feature/
├── my-feature-prompt.md     # Your original description
├── SUMMARY.md               # AI-generated overview and approach
├── EXECUTION_PLAN.md        # Step-by-step strategy
├── STATUS.md                # Current state tracking
└── plan/
    ├── 01-analysis.md       # Detailed step with specific tasks
    ├── 02-design.md         # Concrete acceptance criteria
    ├── 03-implementation.md # Testing strategies
    └── ...
```

**AI vs Templates**: With AI, you get specific, actionable content tailored to your project. Without AI, you get template files with placeholders to fill in manually.

### Checking Status

Show current plan status:

```bash
riotplan status                 # Current directory
riotplan status ./my-plan       # Specific path
riotplan status -v              # Verbose output
riotplan status --json          # JSON output
```

Example output:

```
Plan: my-feature
Status: 🔄 in_progress
Progress: 45% (5/11 steps)
Current Step: 06-testing
Last Updated: 2026-01-10

Blockers: None
Issues: 1 (low priority)
```

### Managing Steps

List steps in a plan:

```bash
riotplan step list              # All steps
riotplan step list --pending    # Only pending
riotplan step list --all        # Include completed
```

Example output:

```
✅ 01 analysis
✅ 02 design
✅ 03 architecture
✅ 04 implementation-core
🔄 05 implementation-api
⬜ 06 testing
⬜ 07 documentation
⬜ 08 release
```

Add a new step:

```bash
riotplan step add "Integration Testing"
riotplan step add "Security Audit" --number 07
riotplan step add "Review" --after 05
```

Mark steps as started or completed:

```bash
riotplan step start 05
riotplan step complete 05
```

### Managing Feedback

Create and list feedback records:

```bash
riotplan feedback create        # Create feedback record
riotplan feedback list          # List feedback records
```

### Validating Plans

Validate plan structure:

```bash
riotplan plan validate          # Current directory
riotplan plan validate ./my-plan # Specific path
riotplan plan validate --fix    # Attempt to fix issues
```

Checks:
- Required files exist (STATUS.md, EXECUTION_PLAN.md, etc.)
- STATUS.md is parseable
- Step files have valid numbering (01-*, 02-*, etc.)
- Step dependencies are valid
- No circular dependencies

Archive a completed plan:

```bash
riotplan plan archive           # Current directory
riotplan plan archive ./my-plan # Specific path
```

### Status Indicators

| Symbol | Meaning |
|--------|---------|
| ⬜ | Pending |
| 🔄 | In Progress |
| ✅ | Completed |
| ❌ | Failed |
| ⏸️ | Blocked |
| ⏭️ | Skipped |

### Generate from Existing Prompt

If you already have a plan directory with a prompt file:

```bash
riotplan generate ./my-plan --steps 5
riotplan generate ./my-plan --provider anthropic --model claude-sonnet-4-5
```

### Configuration

RiotPlan uses a flexible **four-tier configuration system** to determine where plans are stored:

1. **Environment Variable** (`RIOTPLAN_PLAN_DIRECTORY`) - Highest priority
2. **Config File** (`riotplan.config.*`, `.riotplan/config.*`, etc.) - Project-level
3. **Auto-Detection** - Automatically finds `plans/` directory by walking up the tree
4. **Fallback** - Uses `./plans` in current directory (zero-config experience)

**Quick Start:**

```bash
# Most users: Just start using RiotPlan - it finds plans/ automatically!
riotplan create my-feature

# Create a config file (optional)
riotplan --init-config

# Check current configuration
riotplan check-config
```

**Example: `riotplan.config.yaml`**

```yaml
planDirectory: ./plans
defaultProvider: anthropic
defaultModel: claude-3-5-sonnet-20241022
```

**MCP Server Configuration:**

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@riotprompt/riotplan"],
      "env": {
        "RIOTPLAN_PLAN_DIRECTORY": "/path/to/plans"
      }
    }
  }
}
```

See [Configuration Guide](./guide/configuration.md) for complete documentation.

## Catalysts: Composable Planning Intelligence

**Catalysts** are composable, layerable bundles of planning guidance that influence how plans are created. They contain questions, constraints, domain knowledge, and process guidance that help shape plans for specific technologies, organizations, or project types.

### What Catalysts Provide

A catalyst can include any combination of:

- **Questions**: Guiding questions for idea exploration (e.g., "What Node.js version will you target?")
- **Constraints**: Rules plans must satisfy (e.g., "All projects must have 80% test coverage")
- **Output Templates**: Expected deliverables (e.g., Amazon-style press releases, 6-page narratives)
- **Domain Knowledge**: Context about an organization, project, or technology
- **Process Guidance**: How to approach the planning process (tactical vs strategic)
- **Validation Rules**: Post-creation checks

### Catalyst Structure

A catalyst is a directory containing:

```
my-catalyst/
├── catalyst.yml              # Manifest (id, name, version, facets)
├── questions/                # Guiding questions
│   └── *.md
├── constraints/              # Rules and requirements
│   └── *.md
├── domain-knowledge/         # Contextual information
│   └── *.md
├── process-guidance/         # Process recommendations
│   └── *.md
├── output-templates/         # Expected deliverables
│   └── *.md
└── validation-rules/         # Post-creation checks
    └── *.md
```

**Example `catalyst.yml`:**

```yaml
id: '@kjerneverk/catalyst-project'
name: Kjerneverk Project Standards
version: 1.0.0
description: Standard constraints and guidance for all Kjerneverk projects
facets:
  questions: true
  constraints: true
  domainKnowledge: true
  processGuidance: true
```

### Using Catalysts

**Via Configuration** (`riotplan.config.yaml`):

```yaml
planDirectory: ./plans
catalysts:
  - ./catalysts/kjerneverk-project
  - ./catalysts/nodejs
catalystDirectory: ./catalysts
```

**Via Command Line:**

```bash
riotplan create my-feature --catalysts ./catalysts/nodejs,./catalysts/testing
```

**Via MCP Tools:**

```typescript
// List configured catalysts
riotplan_catalyst({ action: 'list' })

// Show catalyst details
riotplan_catalyst({ action: 'show', catalyst: '@kjerneverk/catalyst-project' })

// Associate catalysts with a plan
riotplan_catalyst({
  path: './my-plan',
  action: 'add',
  catalysts: ['@kjerneverk/catalyst-project']
})
```

### Catalyst Layering

Catalysts can be layered to combine guidance from multiple sources:

```yaml
catalysts:
  - ./catalysts/software      # Base software practices
  - ./catalysts/nodejs        # Node.js specific guidance
  - ./catalysts/company       # Company-specific standards
```

Content from multiple catalysts is merged in order (first = base, last = top layer), with source attribution maintained for traceability.

### Catalyst Traceability

When catalysts are used, plans record which catalysts influenced their creation:

- **`plan.yaml`**: Records catalyst IDs in the plan manifest
- **`SUMMARY.md`**: Lists applied catalysts in the plan summary
- **AI Generation**: Catalyst content is injected into the AI prompt, influencing plan generation

### Example Catalyst

See `examples/catalysts/kjerneverk-project/` for a complete working example demonstrating all facets.

### Future: NPM Distribution

In a future release, catalysts will be distributable as NPM packages, allowing you to:

```bash
npm install @kjerneverk/catalyst-nodejs
```

```yaml
catalysts:
  - '@kjerneverk/catalyst-nodejs'  # Resolves from node_modules
```

For now, catalysts are loaded from local directories.

## Programmatic Usage

```typescript
import { loadPlan, resumePlan } from '@riotprompt/riotplan';

// Load an existing plan
const plan = await loadPlan('./prompts/my-feature');

console.log(plan.metadata.code);     // 'my-feature'
console.log(plan.state.status);      // 'in_progress'
console.log(plan.state.currentStep); // 3

// Resume execution
const result = await resumePlan(plan);
```

## Creating a Plan

```typescript
import { createPlan } from 'riotplan';

const plan = await createPlan({
  code: 'my-feature',
  name: 'My Feature Implementation',
  path: './prompts/my-feature',
  description: 'Implement the new feature with proper testing',
  steps: [
    { title: 'Analysis', description: 'Analyze requirements' },
    { title: 'Design', description: 'Design the solution' },
    { title: 'Implementation', description: 'Build it' },
    { title: 'Testing', description: 'Verify it works' },
    { title: 'Documentation', description: 'Document it' },
  ]
});
```

## STATUS.md Format

```markdown
# My Feature - Execution Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | `in_progress` |
| **Current Step** | 03-implementation |
| **Last Completed** | 02-design |
| **Started At** | 2026-01-08 |
| **Last Updated** | 2026-01-10 |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
| 01 | Analysis | ✅ Completed | 2026-01-08 | 2026-01-08 | - |
| 02 | Design | ✅ Completed | 2026-01-08 | 2026-01-09 | - |
| 03 | Implementation | 🔄 In Progress | 2026-01-09 | - | 50% done |
| 04 | Testing | ⬜ Pending | - | - | - |
| 05 | Documentation | ⬜ Pending | - | - | - |

## Blockers

_No blockers currently._

## Issues

_No issues encountered._
```

## Roadmap

### v0.1.0 - Core Functionality
- [ ] Load plans from directories
- [ ] Parse STATUS.md
- [ ] Generate STATUS.md
- [ ] Step file discovery

### v0.2.0 - Execution
- [ ] Execute individual steps
- [ ] Resume from checkpoint
- [ ] Update state automatically

### v0.3.0 - Integration
- [ ] CLI (riotplan-cli)
- [ ] Agentic execution
- [ ] Riotprompt integration

## Related Packages

- `@riotprompt/riotprompt` - Prompt modeling for single interactions
- `@riotprompt/agentic` - Multi-turn conversation framework
- `@riotprompt/execution` - LLM provider interfaces
- `@riotprompt/riotplan-commands-*` - Command packages (plan, status, step, feedback)

## MCP Integration

RiotPlan is available as an MCP (Model Context Protocol) server, allowing AI assistants like Cursor to manage plans directly.

### Setup

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "riotplan": {
      "command": "npx",
      "args": ["-y", "@riotprompt/riotplan"],
      "env": {
        "RIOTPLAN_PLAN_DIRECTORY": "/path/to/plans"
      }
    }
  }
}
```

**Zero-Config Experience:** If you don't set `RIOTPLAN_PLAN_DIRECTORY`, RiotPlan will automatically find your `plans/` directory by walking up from your workspace root. No configuration needed!

The MCP server includes enhanced error handling and logging for better reliability and debugging.

### MCP Tools

**Lifecycle Management:**
- **`riotplan_idea`** - Start exploring an idea (Idea stage)
- **`riotplan_shaping`** - Begin shaping approaches (Shaping stage)
- **`riotplan_build`** - Prepare caller-side generation instructions from idea/shaping artifacts
- **`riotplan_build_validate_plan`** - Validate caller-generated plan JSON against full plan context and issue write stamp
- **`riotplan_build_write_artifact`** - Persist caller-generated SUMMARY/EXECUTION_PLAN/STATUS/PROVENANCE
- **`riotplan_build_write_step`** - Persist caller-generated step markdown files
- **`riotplan_transition`** - Move between lifecycle stages manually

**Plan Management:**
- **`riotplan_plan`** - Unified plan tool with `action: "create" | "switch" | "move"`
- **`riotplan_status`** - Show plan status and progress
- **`riotplan_validate`** - Validate plan structure
- **`riotplan_generate`** - Generate plan content with AI

**Step Management:**
- **`riotplan_step`** - Unified step tool with `action: "start" | "complete" | "add" | "remove" | "move"`

**Idea Stage:**
- **`riotplan_idea`** - Add notes during exploration
- **`riotplan_idea`** - Document constraints
- **`riotplan_idea`** - Raise questions
- **`riotplan_idea`** - Attach supporting materials
- **`riotplan_evidence`** - Unified structured evidence tool with `action: "add" | "edit" | "delete"`
- **`riotplan_idea`** - Abandon idea with reason

**Shaping Stage:**
- **`riotplan_shaping`** - Propose solution approaches
- **`riotplan_shaping`** - Add feedback on approaches
- **`riotplan_shaping`** - Compare all approaches
- **`riotplan_shaping`** - Select best approach

**History & Checkpoints:**
- **`riotplan_checkpoint`** - Save state snapshots
- **`riotplan_checkpoint`** - Restore previous state
- **`riotplan_history_show`** - View timeline of events

### MCP Resources

Read-only access to plan data:

- `riotplan://plan/{path}` - Plan metadata and structure
- `riotplan://status/{path}` - Current status and progress
- `riotplan://steps/{path}` - List of all steps
- `riotplan://step/{path}?number={n}` - Specific step content

### MCP Prompts

Workflow templates for common tasks:

- **`create_plan`** - Guided plan creation workflow
- **`execute_step`** - Step execution workflow with status tracking
- **`track_progress`** - Progress monitoring and status updates

### Example MCP Usage

```typescript
// AI assistant creates a plan
riotplan_plan({
  action: "create",
  code: "user-auth",
  description: "Implement JWT-based authentication",
  steps: 6
})

// Check status
riotplan_status({ path: "./user-auth" })

// Start and complete steps
riotplan_step({ planId: "./user-auth", action: "start", step: 1 })
// ... do the work ...
riotplan_step({ planId: "./user-auth", action: "complete", step: 1 })
```

### For AI Assistants: Executing Plans with Tracking

**When executing a RiotPlan, you MUST use RiotPlan's tracking infrastructure:**

1. **Check if step files exist** in `plan/` directory
   - If `EXECUTION_PLAN.md` exists but step files don't, create them first
   - Step files (e.g., `01-step.md`, `02-step.md`) are required for tracking

2. **For each step you execute:**
   - Call `riotplan_step({ planId: path, action: "start", step: N })` **BEFORE** doing any work
   - Do the actual work (implement, test, document)
   - Call `riotplan_step({ planId: path, action: "complete", step: N })` **AFTER** completing the work
   - Let RiotPlan update STATUS.md automatically

3. **Use the `execute_plan` prompt** for guided execution:
   ```
   /riotplan/execute_plan
   ```
   This provides the complete workflow for executing with tracking.

**Key Principle**: If you're working on a RiotPlan, RiotPlan should manage the execution, not just the planning. Don't just do the work - use the tracking tools!

**Common Mistake**: Executing steps without using `riotplan_step` start/complete actions. This bypasses RiotPlan's execution management and breaks progress tracking.

See [guide/mcp.md](./guide/mcp.md) for detailed MCP documentation.

## Philosophy

Plans bridge the gap between:
- **Prompts** (single interactions)
- **Agentic conversations** (multi-turn sessions)
- **Long-running workflows** (days/weeks of work)

A plan provides structure for complex, iterative AI-assisted work where:
- The work can't be done in one session
- Progress needs to be tracked
- Humans need to review and provide feedback
- The approach may evolve based on findings

## License

Apache-2.0

<!-- v1.0.0 -->
TEST
