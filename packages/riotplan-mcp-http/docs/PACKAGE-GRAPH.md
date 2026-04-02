# Package dependency graph (HTTP MCP)

`@planvokter/riotplan-mcp-http` **depends** on `@planvokter/riotplan` in `dependencies`. The framework package does **not** depend on this HTTP package, so there is no npm dependency cycle.

- **Dependencies** — `@planvokter/riotplan` (framework entry: plan loaders, step ops, status generator, etc.), plus leaf-ish packages such as `@planvokter/riotplan-core`, `@planvokter/riotplan-format`, `@planvokter/riotplan-catalyst`, `@planvokter/riotplan-cloud`, `@planvokter/riotplan-ai`, and transport/logging stacks.

**Publish order**: publish `@planvokter/riotplan` before (or concurrently with) a `@planvokter/riotplan-mcp-http` release that bumps its `riotplan` range. Consumers who install only `@planvokter/riotplan-mcp-http` get `riotplan` transitively.

**Future** — migrate remaining `@planvokter/riotplan` imports into `riotplan-core` (or smaller packages) if you want the HTTP server to depend on a thinner surface.

**Local development** — `tsc` needs a built `@planvokter/riotplan` whose `dist/` matches the workspace. After `npm run build` in `riotplan-core` and `riotplan`, run `npm link` in each and `npm link @planvokter/riotplan` inside `riotplan-mcp-http`, or use your monorepo’s workspace install.

**Registry** — plain `npm install` resolves `@planvokter/riotplan` from the registry per the semver range in `riotplan-mcp-http/package.json`.
