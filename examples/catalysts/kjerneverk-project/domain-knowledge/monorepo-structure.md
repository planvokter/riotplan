# Kjerneverk Monorepo Structure

The Kjerneverk project uses a monorepo structure with independently versioned packages:

## Package Organization

- **@planvokter/riotplan**: Framework for long-lived, stateful AI workflows
- **@kjerneverk/riotdoc**: Documentation generation system
- **@kjerneverk/riotprompt**: Prompt management and versioning
- **@kjerneverk/execution**: Core execution engine for AI providers
- **@kjerneverk/execution-anthropic**: Anthropic provider implementation
- **@kjerneverk/execution-openai**: OpenAI provider implementation
- **@kjerneverk/execution-gemini**: Gemini provider implementation
- **@kjerneverk/execution-sampling**: Sampling-based execution
- **@kjerneverk/agentic**: Agentic workflow primitives

## Package Consumption

- Packages are published to NPM independently
- During development, use `npm link` for local package dependencies
- Each package has its own version and release cycle
- Packages depend on each other via NPM, not workspace references
