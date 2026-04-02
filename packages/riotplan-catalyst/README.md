# @planvokter/riotplan-catalyst

Catalyst system for RiotPlan - composable, layerable guidance packages that shape the entire planning process.

## What is a Catalyst?

A catalyst is a collection of resources that affects the questions asked and the process used to come up with a plan. It provides guidance through six facets:

- **Questions** - Things to consider during exploration
- **Constraints** - Rules the plan must satisfy
- **Output Templates** - Expected deliverables
- **Domain Knowledge** - Context about the domain
- **Process Guidance** - How to approach the planning process
- **Validation Rules** - Post-creation checks

## Installation

```bash
npm install @planvokter/riotplan-catalyst
```

## Usage

### Loading a Single Catalyst

```typescript
import { loadCatalyst } from '@planvokter/riotplan-catalyst';

// Load a catalyst from a directory
const result = await loadCatalyst('./my-catalyst');

if (result.success) {
  console.log('Loaded:', result.catalyst.manifest.name);
  console.log('Facets:', Object.keys(result.catalyst.facets));
} else {
  console.error('Failed to load:', result.error);
}
```

### Loading Multiple Catalysts

```typescript
import { resolveCatalysts } from '@planvokter/riotplan-catalyst';

// Resolve multiple catalysts by path
const catalysts = await resolveCatalysts([
  './catalysts/software',
  './catalysts/nodejs',
  './catalysts/company'
]);

console.log(`Loaded ${catalysts.length} catalysts`);
```

### Merging Catalysts

```typescript
import { resolveCatalysts, mergeCatalysts } from '@planvokter/riotplan-catalyst';

// Load and merge catalysts
const catalysts = await resolveCatalysts(['./catalyst-1', './catalyst-2']);
const merged = mergeCatalysts(catalysts);

// Access merged content
console.log('Applied catalysts:', merged.catalystIds);
console.log('Questions:', merged.facets.questions);
console.log('Constraints:', merged.facets.constraints);
```

### Working with Plan Manifests

```typescript
import { 
  readPlanManifest, 
  writePlanManifest,
  addCatalystToManifest 
} from '@planvokter/riotplan-catalyst';

// Read plan manifest
const manifest = await readPlanManifest('./my-plan');
console.log('Plan:', manifest.title);
console.log('Catalysts:', manifest.catalysts);

// Add a catalyst to a plan
await addCatalystToManifest('./my-plan', '@kjerneverk/catalyst-nodejs');

// Create a new plan manifest
await writePlanManifest('./new-plan', {
  id: 'new-plan',
  title: 'New Plan',
  catalysts: ['@kjerneverk/catalyst-nodejs'],
  created: new Date().toISOString()
});
```

## Catalyst Directory Structure

```
my-catalyst/
  catalyst.yml              # Manifest (required)
  questions/                # Optional
    exploration.md          # Questions for idea phase
  constraints/              # Optional
    testing.md              # Testing requirements
  output-templates/         # Optional
    press-release.md        # Press release template
  domain-knowledge/         # Optional
    overview.md             # Domain context
  process-guidance/         # Optional
    lifecycle.md            # Process guidance
  validation-rules/         # Optional
    checklist.md            # Validation checklist
```

## Schema Reference

### catalyst.yml

```yaml
id: '@myorg/catalyst-name'        # NPM package name format (required)
name: 'Human Readable Name'       # Display name (required)
version: '1.0.0'                  # Semver version (required)
description: 'What this provides' # Description (required)
facets:                           # Optional - auto-detected if omitted
  questions: true
  constraints: true
  outputTemplates: true
  domainKnowledge: true
  processGuidance: true
  validationRules: true
```

**Validation Rules:**
- `id` must be a valid NPM package name (e.g., `@scope/name` or `name`)
- `version` must be valid semver (e.g., `1.0.0` or `1.0.0-dev.0`)
- `name` and `description` cannot be empty
- Facets are optional - if omitted, detected from directory structure

### plan.yaml

```yaml
id: 'plan-identifier'             # Plan ID (required)
title: 'Plan Title'               # Display title (required)
catalysts:                        # Optional - list of catalyst IDs
  - '@myorg/catalyst-nodejs'
  - '@myorg/catalyst-company'
created: '2026-01-15T10:30:00Z'   # ISO timestamp (optional)
metadata:                         # Optional - extensible
  author: 'John Doe'
  tags: ['feature', 'api']
```

## API Reference

### Loader Functions

#### `loadCatalyst(path: string): Promise<CatalystLoadResult>`

Load a single catalyst from a directory.

**Returns:**
```typescript
{
  success: true,
  catalyst: {
    manifest: { id, name, version, description, facets },
    directory: '/absolute/path',
    facets: {
      questions: [{ filename, content }],
      constraints: [{ filename, content }],
      // ... other facets
    }
  }
}
// or
{
  success: false,
  error: 'Error message'
}
```

#### `loadCatalystSafe(path: string): Promise<Catalyst | null>`

Load a catalyst, returning null on error (no exception thrown).

#### `resolveCatalysts(identifiers: string[]): Promise<Catalyst[]>`

Load multiple catalysts by path. Skips any that fail to load.

**Example:**
```typescript
const catalysts = await resolveCatalysts([
  './catalyst-1',
  './catalyst-2',
  './catalyst-3'
]);
// Returns only successfully loaded catalysts
```

### Merger Functions

#### `mergeCatalysts(catalysts: Catalyst[]): MergedCatalyst`

Merge multiple catalysts into a single structure with source attribution.

**Returns:**
```typescript
{
  catalystIds: ['@org/cat-1', '@org/cat-2'],
  facets: {
    questions: [
      { content: '...', sourceId: '@org/cat-1', filename: 'setup.md' },
      { content: '...', sourceId: '@org/cat-2', filename: 'config.md' }
    ],
    // ... other facets
  }
}
```

#### `renderFacet(facetName: string, merged: MergedCatalyst): string`

Render a single facet as markdown with source attribution.

#### `renderAllFacets(merged: MergedCatalyst): Record<string, string>`

Render all facets as markdown strings.

**Example:**
```typescript
const rendered = renderAllFacets(merged);
console.log(rendered.questions);
console.log(rendered.constraints);
```

### Plan Manifest Functions

#### `readPlanManifest(planPath: string): Promise<PlanManifest>`

Read plan.yaml from a plan directory.

#### `writePlanManifest(planPath: string, manifest: PlanManifest): Promise<void>`

Write plan.yaml to a plan directory.

#### `updatePlanManifest(planPath: string, updates: Partial<PlanManifest>): Promise<void>`

Update specific fields in plan.yaml.

#### `addCatalystToManifest(planPath: string, catalystId: string): Promise<void>`

Add a catalyst ID to the plan's catalyst list (if not already present).

#### `removeCatalystFromManifest(planPath: string, catalystId: string): Promise<void>`

Remove a catalyst ID from the plan's catalyst list.

## TypeScript Types

```typescript
// Catalyst manifest
interface CatalystManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  facets?: FacetsDeclaration;
}

// Facet content
interface FacetContent {
  filename: string;
  content: string;
}

// Loaded catalyst
interface Catalyst {
  manifest: CatalystManifest;
  directory: string;
  facets: CatalystFacets;
}

// Merged catalyst with attribution
interface MergedCatalyst {
  catalystIds: string[];
  facets: Record<string, AttributedContent[]>;
}

interface AttributedContent {
  content: string;
  sourceId: string;
  filename?: string;
}

// Plan manifest
interface PlanManifest {
  id: string;
  title: string;
  catalysts?: string[];
  created?: string;
  metadata?: Record<string, string>;
}
```

## Error Handling

All loader functions return structured results:

```typescript
// Success
{ success: true, catalyst: Catalyst }

// Failure
{ success: false, error: string }
```

Safe variants return `null` on error:

```typescript
const catalyst = await loadCatalystSafe('./path');
if (catalyst === null) {
  console.error('Failed to load');
}
```

## License

Apache-2.0
TEST
TEST
TEST
