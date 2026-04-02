# Development Guide

**Purpose**: Instructions for contributing to and developing `riotplan`.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Build**:
    ```bash
    npm run build
    ```
    This builds the library to `dist/`.

## Testing

We use **Vitest** for testing.

*   **Run Tests**:
    ```bash
    npm test
    ```
*   **Run with Coverage**:
    ```bash
    npm run test:coverage
    ```

### Test Structure

*   `tests/unit/`: Tests for individual modules (loader, parser, generator).
*   `tests/integration/`: End-to-end tests for plan workflows.

### Mocking

Tests that involve filesystem operations MUST use mocks or temporary directories.
*   **Filesystem**: Use `fs/promises` mocks or `fs.mkdtemp` for temp directories.

## Project Structure

```
riotplan/
├── src/                    # Source code
│   ├── index.ts           # Main entry point
│   ├── types.ts           # Type definitions
│   ├── loader.ts          # Plan loading (TBD)
│   ├── parser.ts          # STATUS.md parsing (TBD)
│   ├── generator.ts       # STATUS.md generation (TBD)
│   └── executor.ts        # Step execution (TBD)
├── tests/                  # Unit and integration tests
├── guide/                  # AI agent documentation
├── .github/               # GitHub workflows
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Adding Features

1.  **New File Conventions**: Update `types.ts` with new patterns and update the loader.
2.  **New Status Fields**: Update `StatusDocument` interface and parser/generator.
3.  **New CLI Commands**: Will be added to `riotplan-cli` package.

## Linting

*   **Check**: `npm run lint`
*   **Fix**: `npm run lint:fix`

## Releasing

1.  Update version in `package.json`
2.  Update CHANGELOG (if any)
3.  Create a GitHub release
4.  npm-publish workflow will automatically publish to npm
