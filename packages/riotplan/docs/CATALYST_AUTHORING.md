# Catalyst Authoring Guide

This guide explains how to create effective catalysts for RiotPlan.

## What is a Catalyst?

A **catalyst** is a composable bundle of planning intelligence that influences how plans are created. Catalysts contain questions, constraints, domain knowledge, and process guidance that help shape plans for specific technologies, organizations, or project types.

Think of catalysts as "planning lenses" that help AI assistants and human planners focus on the right concerns for a given context.

## Catalyst Structure

A catalyst is a directory containing:

```
my-catalyst/
├── catalyst.yml              # Manifest (required)
├── questions/                # Guiding questions (optional)
│   └── *.md
├── constraints/              # Rules and requirements (optional)
│   └── *.md
├── domain-knowledge/         # Contextual information (optional)
│   └── *.md
├── process-guidance/         # Process recommendations (optional)
│   └── *.md
├── output-templates/         # Expected deliverables (optional)
│   └── *.md
└── validation-rules/         # Post-creation checks (optional)
    └── *.md
```

### Manifest File (`catalyst.yml`)

The manifest is the only required file. It defines the catalyst's identity and declares which facets it provides:

```yaml
id: '@myorg/catalyst-nodejs'
name: Node.js Development Standards
version: 1.0.0
description: Best practices and standards for Node.js projects
facets:
  questions: true
  constraints: true
  domainKnowledge: true
  processGuidance: true
```

**Required Fields:**
- `id`: Catalyst identifier (must be a valid NPM package name)
- `name`: Human-readable name
- `version`: Semver version string (e.g., `1.0.0` or `1.0.0-dev.0`)
- `description`: What this catalyst provides

**Optional Fields:**
- `facets`: Declaration of which facets this catalyst provides (if omitted, auto-detected from directory structure)

## The Six Facets

### 1. Questions

**Purpose**: Guiding questions to help explore ideas and gather necessary information.

**When to use**: When there are important decisions or information needs that should be addressed during planning.

**Example** (`questions/project-setup.md`):

```markdown
# Project Setup Questions

When creating a new Node.js project, consider:

1. **Node.js Version**: What Node.js version will this target? (Recommended: >=20.0.0)

2. **Package Manager**: Will you use npm, yarn, or pnpm?

3. **Module System**: ESM (type: "module") or CommonJS?

4. **TypeScript**: Will this use TypeScript? If so, what target and module resolution?

5. **Testing Framework**: Jest, Vitest, Mocha, or another framework?
```

**Best Practices:**
- Frame as open-ended questions, not yes/no
- Provide context or recommendations where helpful
- Group related questions together
- Focus on decisions that impact the plan, not implementation details

### 2. Constraints

**Purpose**: Rules, requirements, and standards that plans must satisfy.

**When to use**: When there are non-negotiable requirements or organizational standards.

**Example** (`constraints/testing-requirements.md`):

```markdown
# Testing Requirements

All Node.js projects must include:

1. **Test Coverage**: Minimum 80% code coverage for lines, functions, and branches

2. **Test Framework**: Use Vitest for new projects (Jest for existing)

3. **Test Structure**: 
   - Unit tests in `tests/` directory
   - Integration tests in `tests/integration/`
   - Test files named `*.test.ts` or `*.test.js`

4. **CI Integration**: Tests must run in CI before merge

5. **Coverage Reporting**: Generate coverage reports with v8 provider
```

**Best Practices:**
- Be specific and actionable
- Explain the "why" when it's not obvious
- Use numbered lists for multiple requirements
- Separate different types of constraints into different files

### 3. Domain Knowledge

**Purpose**: Contextual information about an organization, project, technology, or domain.

**When to use**: When there's important background information that should inform planning decisions.

**Example** (`domain-knowledge/monorepo-structure.md`):

```markdown
# Monorepo Structure

Our organization uses a monorepo with independently versioned packages:

## Package Organization

- **@myorg/core**: Core utilities and types
- **@myorg/api**: REST API framework
- **@myorg/cli**: Command-line tools
- **@myorg/web**: Web application

## Development Workflow

- Packages are published to NPM independently
- During development, use `npm link` for local dependencies
- Each package has its own version and release cycle
- Packages depend on each other via NPM, not workspace references

## Build System

- We use Vite for library builds
- TypeScript with strict mode enabled
- ESLint with our custom config (@myorg/eslint-config)
```

**Best Practices:**
- Focus on information that's hard to discover elsewhere
- Include architectural patterns and conventions
- Document dependencies and relationships
- Explain organizational or project-specific terminology

### 4. Process Guidance

**Purpose**: Recommendations for how to approach the planning and execution process.

**When to use**: When there are preferred workflows, methodologies, or approaches.

**Example** (`process-guidance/development-workflow.md`):

```markdown
# Development Workflow

When planning Node.js projects, follow this workflow:

## Planning Phase

1. **Start with Requirements**: Clearly define what needs to be built
2. **Consider Alternatives**: Explore multiple approaches before committing
3. **Identify Dependencies**: Map out external and internal dependencies
4. **Plan for Testing**: Design test strategy upfront, not as an afterthought

## Implementation Phase

1. **Test-Driven Development**: Write tests before implementation
2. **Incremental Progress**: Break work into small, testable chunks
3. **Continuous Integration**: Commit and test frequently
4. **Code Review**: All changes reviewed before merge

## Quality Standards

- All code must pass linting (ESLint)
- All tests must pass before committing
- Code coverage should meet or exceed 80%
- Documentation should be updated with code changes
```

**Best Practices:**
- Provide workflow recommendations, not rigid rules
- Explain the reasoning behind process choices
- Include both planning and execution guidance
- Balance prescriptiveness with flexibility

### 5. Output Templates

**Purpose**: Expected deliverables or artifacts that should be produced.

**When to use**: When plans should produce specific types of documents or artifacts.

**Example** (`output-templates/press-release.md`):

```markdown
# Press Release Template

For major features, create a press release as if the feature is launching:

## Format

**Headline**: [Feature Name] - [One-line benefit]

**Subheadline**: [Expand on the benefit]

**Problem**: What problem does this solve?

**Solution**: How does this feature solve it?

**Customer Quote**: What would a customer say about this?

**How It Works**: Brief explanation of the user experience

**Call to Action**: What should readers do next?

## Example

**Headline**: Real-Time Collaboration - Work Together Seamlessly

**Subheadline**: Multiple team members can now edit documents simultaneously with instant sync

**Problem**: Teams waste time with version conflicts and email attachments...

[etc.]
```

**Best Practices:**
- Provide clear templates or examples
- Explain the purpose of each deliverable
- Include formatting guidelines
- Show examples of good outputs

### 6. Validation Rules

**Purpose**: Post-creation checks to verify plan quality and completeness.

**When to use**: When there are specific criteria plans should meet.

**Example** (`validation-rules/completeness-checks.md`):

```markdown
# Plan Completeness Checks

Before finalizing a plan, verify:

## Required Steps

- [ ] Plan includes a testing step with specific test cases
- [ ] Plan includes a documentation step covering README and API docs
- [ ] Plan includes a review/validation step before completion

## Required Artifacts

- [ ] README.md with installation and usage instructions
- [ ] CHANGELOG.md for tracking changes
- [ ] LICENSE file (Apache-2.0 for open source)

## Quality Checks

- [ ] Each step has clear acceptance criteria
- [ ] Dependencies between steps are explicit
- [ ] Estimated effort is reasonable for each step
- [ ] Success metrics are defined
```

**Best Practices:**
- Use checklists for easy verification
- Focus on completeness and quality, not implementation details
- Group related checks together
- Make checks actionable and objective

## Catalyst Types

### Technology Catalysts

Focus on specific technologies or frameworks:

```
@myorg/catalyst-nodejs
@myorg/catalyst-react
@myorg/catalyst-python
```

**Typical facets**: Questions (version, tooling), Constraints (standards), Domain Knowledge (patterns)

### Organization Catalysts

Encode organizational standards and culture:

```
@myorg/catalyst-company
@acme/catalyst-engineering
```

**Typical facets**: Constraints (requirements), Process Guidance (workflows), Output Templates (deliverables)

### Project Catalysts

Specific to individual projects or codebases:

```
@myorg/catalyst-myapp
./catalysts/legacy-system
```

**Typical facets**: Domain Knowledge (architecture), Constraints (compatibility), Process Guidance (deployment)

### Domain Catalysts

Focus on problem domains:

```
@myorg/catalyst-finance
@myorg/catalyst-legal
@myorg/catalyst-security
```

**Typical facets**: Questions (compliance), Constraints (regulations), Domain Knowledge (terminology)

## Layering Catalysts

Catalysts can be layered to combine guidance from multiple sources:

```yaml
catalysts:
  - '@myorg/catalyst-software'    # Base software practices
  - '@myorg/catalyst-nodejs'      # Node.js specific
  - '@myorg/catalyst-company'     # Company standards
  - './catalysts/myproject'       # Project-specific
```

**Layering principles:**
- Order matters: first = base, last = top layer
- More specific catalysts should come after general ones
- Content is concatenated with source attribution
- Later catalysts can add to (but not remove) earlier constraints

## Writing Effective Catalyst Content

### Use Markdown Effectively

- Use headings (`#`, `##`, `###`) to structure content
- Use lists for multiple items
- Use code blocks for examples
- Use bold for emphasis on key terms

### Be Specific but Not Prescriptive

**Good**: "Consider using Vitest for new projects due to its speed and ESM support"

**Too vague**: "Use a good testing framework"

**Too prescriptive**: "You must use Vitest version 1.2.0 with these exact configuration options..."

### Provide Context and Rationale

**Good**: "We require 80% test coverage because it catches most bugs while remaining achievable"

**Missing context**: "80% test coverage required"

### Focus on the "What" and "Why", Not the "How"

Catalysts guide planning, not implementation. Focus on what should be considered and why it matters, not step-by-step implementation instructions.

**Good** (in constraints): "All APIs must have rate limiting to prevent abuse"

**Too detailed**: "Install express-rate-limit, configure it with windowMs: 15 * 60 * 1000, max: 100..."

### Use Examples

Show concrete examples of what you mean:

```markdown
## API Documentation

All public APIs should be documented with:

### Example

```typescript
/**
 * Fetches user data by ID
 * @param userId - The unique user identifier
 * @returns User object or null if not found
 * @throws {NotFoundError} If user doesn't exist
 */
async function getUser(userId: string): Promise<User | null>
```
```

## Testing Your Catalyst

### Manual Testing

1. Create a test plan with your catalyst:

```bash
riotplan create test-plan --catalysts ./my-catalyst
```

2. Review the generated plan to verify catalyst influence:
   - Check SUMMARY.md for catalyst traceability
   - Verify constraints appear in the plan
   - Confirm questions guided the planning process

### Automated Testing

Use the `@planvokter/riotplan-catalyst` package to test catalyst loading:

```typescript
import { loadCatalyst } from '@planvokter/riotplan-catalyst';

const result = await loadCatalyst('./my-catalyst');
if (!result.success) {
  console.error('Failed to load catalyst:', result.error);
}
```

## Versioning Catalysts

Follow semantic versioning:

- **Major** (2.0.0): Breaking changes to structure or requirements
- **Minor** (1.1.0): New facets or non-breaking additions
- **Patch** (1.0.1): Clarifications, typo fixes, minor improvements

## Publishing Catalysts

### Local Development

During development, reference catalysts by local path:

```yaml
catalysts:
  - './catalysts/my-catalyst'
```

### Future: NPM Distribution

In a future release, catalysts will be publishable as NPM packages:

```bash
cd my-catalyst
npm init --scope=@myorg
npm publish
```

```yaml
catalysts:
  - '@myorg/catalyst-nodejs'
```

## Example Catalysts

See the `examples/catalysts/` directory in the RiotPlan repository for complete working examples:

- **project-standards**: Demonstrates all six facets with realistic content
- Shows proper directory structure and manifest format
- Includes well-written content for each facet type

## Best Practices Summary

1. **Start small**: Begin with just constraints or questions, add other facets as needed
2. **Be specific**: Provide concrete guidance, not vague suggestions
3. **Explain why**: Include rationale for requirements and recommendations
4. **Use examples**: Show what good looks like
5. **Layer thoughtfully**: Combine general and specific catalysts
6. **Version carefully**: Follow semver for breaking changes
7. **Test thoroughly**: Verify catalysts work as intended
8. **Document clearly**: Write for humans who will use the catalyst

## Getting Help

- See the main RiotPlan README for catalyst usage
- Check `@planvokter/riotplan-catalyst` package documentation for API details
- Review example catalysts in `examples/catalysts/`
- Open an issue on GitHub for questions or feedback
