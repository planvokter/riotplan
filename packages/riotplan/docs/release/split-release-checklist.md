# Split Release Checklist

Use this checklist before publishing split package releases.

## Version Coordination

- Confirm aligned version bump strategy for:
  - `@planvokter/riotplan`
  - `@planvokter/riotplan-core`
  - `@planvokter/riotplan-mcp-http`
  - `@planvokter/riotplan-format`
- Verify peer dependency ranges remain compatible.

## Compatibility Gates

- Run `npm run build` in `riotplan`.
- Run `npm run test` in `riotplan`.
- Confirm parity matrix in `docs/verification/parity-matrix.md` is current.
- Confirm legacy binaries:
  - `riotplan`
  - `riotplan-mcp-http`

## Migration Docs Gates

- Validate `docs/migration/split-packages.md` against actual exports.
- Confirm import mapping and deprecation window are still accurate.
- Validate sibling-project paths and package names.

## Rollback Strategy

- Keep compatibility exports active in `@planvokter/riotplan` until post-release
  parity checks pass.
- If regressions are detected, rollback by republishing compatibility package
  with previous forwarding behavior while preserving SQLite schema continuity.
