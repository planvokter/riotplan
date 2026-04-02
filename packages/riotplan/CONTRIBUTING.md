# Contributing to RiotPlan

Thank you for your interest in contributing to RiotPlan!

## Development Setup

### Prerequisites

- **Node.js 24+**
- **npm 10+**
- **Python 3.11+** (for sampling tests)
- **Git**

### Clone and Install

```bash
git clone https://github.com/planvokter/riotplan.git
cd riotplan
npm install
```

### Build

```bash
npm run build
```

This builds both the main package and the MCP server.

### Run Tests

```bash
# Node.js tests
npm test

# Python sampling tests (requires setup)
npm run test:sampling
```

## Python Sampling Tests Setup

RiotPlan includes Python tests for MCP sampling using FastMCP.

### 1. Install Python Dependencies

```bash
cd tests/sampling
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure API Keys

```bash
cp .env.example .env
# Edit .env and add your keys:
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run Sampling Tests

```bash
# From riotplan root
npm run test:sampling

# Or directly
cd tests/sampling
pytest -v
```

See `tests/sampling/README.md` for detailed instructions.

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

- Write code
- Add tests
- Update documentation

### 3. Run Precommit Checks

```bash
npm run precommit
```

This runs:
- Build
- Linting
- Node.js tests
- Python sampling tests (if environment is set up)

### 4. Commit

```bash
git add .
git commit -m "feat: add my feature"
```

Use conventional commit messages:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `test:` - Tests
- `refactor:` - Code refactoring
- `chore:` - Maintenance

### 5. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a pull request on GitHub.

## Project Structure

```
riotplan/
├── src/
│   ├── ai/              # AI provider loading
│   ├── commands/        # CLI commands
│   ├── mcp/             # MCP server
│   │   ├── session/     # Session management (sampling)
│   │   ├── tools/       # MCP tools
│   │   ├── resources/   # MCP resources
│   │   └── prompts/     # MCP prompts
│   ├── plan/            # Plan management
│   └── types.ts         # Core types
├── tests/
│   └── sampling/        # Python FastMCP tests
├── scripts/             # Helper scripts
├── docs/                # Documentation
└── dist/                # Build output
```

## Testing Guidelines

### Node.js Tests

- Use Vitest
- Place tests next to source files (`*.test.ts`)
- Aim for >80% coverage

### Python Sampling Tests

- Use pytest
- Test with both OpenAI and Anthropic handlers
- Use parametrized fixtures for multiple handlers
- Skip tests gracefully if API keys not set

### Test Naming

```typescript
// Good
test('should create session with sampling capability', () => {});

// Bad
test('test1', () => {});
```

## Code Style

### TypeScript

- Use strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Use type annotations

```typescript
// Good
/**
 * Load a provider based on session context
 */
export async function loadProvider(config: ProviderConfig): Promise<Provider> {
  // ...
}

// Bad
export async function load(c: any) {
  // ...
}
```

### Python

- Follow PEP 8
- Use type hints
- Add docstrings for functions
- Use meaningful variable names

```python
# Good
async def test_sampling_plan_generation(
    sampling_client: tuple[Client, str],
    temp_plan_dir: Path
) -> None:
    """Test that RiotPlan uses MCP sampling to generate a plan."""
    # ...

# Bad
async def test1(c, t):
    # ...
```

## Documentation

### Update Documentation When:

- Adding new features
- Changing behavior
- Adding configuration options
- Fixing bugs (if not obvious)

### Documentation Files

- `README.md` - Main documentation
- `docs/SAMPLING.md` - MCP sampling guide
- `tests/sampling/README.md` - Test setup
- JSDoc comments in code

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass (`npm run precommit`)
- [ ] Code is formatted
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] Branch is up to date with `working`

### PR Description

Include:
- **What**: What does this PR do?
- **Why**: Why is this change needed?
- **How**: How does it work?
- **Testing**: How was it tested?

Example:

```markdown
## What
Add support for MCP sampling in provider loading

## Why
Eliminates need for duplicate API keys when using RiotPlan via MCP

## How
- Created SessionContext types
- Implemented SessionManager
- Updated provider-loader.ts
- Added FastMCP tests

## Testing
- All Node.js tests pass
- Python sampling tests pass with both OpenAI and Anthropic
- Tested with FastMCP client
```

## Release Process

Releases are automated via GitHub Actions:

1. Merge to `working` branch
2. GitHub Actions runs tests
3. If tests pass, publishes to npm with `dev` tag
4. For production release, create GitHub release

## Getting Help

- **Issues**: https://github.com/planvokter/riotplan/issues
- **Discussions**: https://github.com/planvokter/riotplan/discussions
- **Email**: tobrien@discursive.com

## Code of Conduct

- Be respectful
- Be constructive
- Be collaborative
- Be patient

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

---

Thank you for contributing to RiotPlan! 🎉
