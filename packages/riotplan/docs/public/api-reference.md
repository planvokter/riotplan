# API Reference

Complete API documentation for programmatic use of RiotPlan.

## Installation

```bash
npm install @planvokter/riotplan
```

## Core Functions

### loadPlan

Load an existing plan from a directory.

```typescript
async function loadPlan(path: string): Promise<Plan>
```

**Parameters:**
- `path` - Path to plan directory

**Returns:** `Plan` object with metadata, state, and steps

**Example:**

```typescript
import { loadPlan } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

console.log(plan.metadata.code);     // 'my-feature'
console.log(plan.state.status);      // 'in_progress'
console.log(plan.state.currentStep); // 3
console.log(plan.steps.length);      // 8
```

### createPlan

Create a new plan programmatically.

```typescript
async function createPlan(options: CreatePlanOptions): Promise<Plan>
```

**Parameters:**

```typescript
interface CreatePlanOptions {
  code: string;              // Plan identifier
  name?: string;             // Human-readable name
  path: string;              // Directory path
  description: string;       // Plan description
  steps?: StepDefinition[];  // Step definitions
  provider?: string;         // AI provider
  model?: string;            // AI model
}

interface StepDefinition {
  title: string;
  description: string;
  tasks?: string[];
  acceptanceCriteria?: string[];
}
```

**Example:**

```typescript
import { createPlan } from '@planvokter/riotplan';

const plan = await createPlan({
  code: 'user-auth',
  name: 'User Authentication',
  path: './prompts/user-auth',
  description: 'Implement secure user authentication',
  steps: [
    {
      title: 'Requirements Analysis',
      description: 'Gather and document requirements',
      tasks: ['Review security requirements', 'Document use cases'],
      acceptanceCriteria: ['All requirements documented', 'Stakeholders approved']
    },
    {
      title: 'Implementation',
      description: 'Build the authentication system'
    }
  ]
});
```

### resumePlan

Resume execution from current state.

```typescript
async function resumePlan(
  plan: Plan,
  options?: ResumePlanOptions
): Promise<ExecutionResult>
```

**Parameters:**

```typescript
interface ResumePlanOptions {
  logger?: Logger;
  skipFailed?: boolean;
  executor?: StepExecutor;
}
```

**Returns:**

```typescript
interface ExecutionResult {
  success: boolean;
  completedSteps: number[];
  failedSteps: number[];
  duration: number;
  errors?: Error[];
}
```

**Example:**

```typescript
import { loadPlan, resumePlan } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

const result = await resumePlan(plan, {
  logger: console,
  skipFailed: false
});

console.log(result.success);          // true
console.log(result.completedSteps);   // [3, 4, 5]
console.log(result.duration);         // 12500 (ms)
```

## Step Management

### startStep

Mark a step as started.

```typescript
async function startStep(plan: Plan, stepNumber: number): Promise<Plan>
```

**Example:**

```typescript
import { loadPlan, startStep } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');
const updatedPlan = await startStep(plan, 5);
```

### completeStep

Mark a step as completed.

```typescript
async function completeStep(
  plan: Plan,
  stepNumber: number,
  options?: CompleteStepOptions
): Promise<Plan>
```

**Parameters:**

```typescript
interface CompleteStepOptions {
  notes?: string;
  duration?: number;
}
```

**Example:**

```typescript
import { loadPlan, completeStep } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');
const updatedPlan = await completeStep(plan, 5, {
  notes: 'All endpoints working correctly'
});
```

### addStep

Add a new step to the plan.

```typescript
async function addStep(
  plan: Plan,
  options: AddStepOptions
): Promise<Plan>
```

**Parameters:**

```typescript
interface AddStepOptions {
  title: string;
  description?: string;
  after?: number;      // Insert after this step
  number?: number;     // Insert at this position
  tasks?: string[];
  acceptanceCriteria?: string[];
}
```

**Example:**

```typescript
import { loadPlan, addStep } from '@planvokter/riotplan';

const plan = await loadPlan('./my-feature');
const updatedPlan = await addStep(plan, {
  title: 'Integration Testing',
  description: 'Test all components together',
  after: 5,
  tasks: ['Write integration tests', 'Run test suite'],
  acceptanceCriteria: ['All tests pass', 'Coverage > 80%']
});
```

## Type Definitions

### Plan

```typescript
interface Plan {
  metadata: PlanMetadata;
  state: PlanState;
  steps: PlanStep[];
  files: PlanFiles;
}

interface PlanMetadata {
  code: string;
  name: string;
  description?: string;
  created: Date;
  author?: string;
}

interface PlanState {
  status: PlanStatus;
  currentStep?: number;
  lastCompleted?: number;
  started?: Date;
  lastUpdated: Date;
  progress: number;  // Percentage (0-100)
}

type PlanStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'failed';
```

### PlanStep

```typescript
interface PlanStep {
  number: number;
  title: string;
  description?: string;
  status: StepStatus;
  file: string;
  started?: Date;
  completed?: Date;
  duration?: number;
  notes?: string;
  dependencies?: number[];
}

type StepStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'skipped';
```

### PlanFiles

```typescript
interface PlanFiles {
  prompt: string;           // {code}-prompt.md
  summary: string;          // SUMMARY.md
  executionPlan: string;    // EXECUTION_PLAN.md
  status: string;           // STATUS.md
  steps: string[];          // plan/XX-*.md
  analysis?: string;        // analysis/ directory
}
```

## Validation

### validatePlan

Validate plan structure and files.

```typescript
async function validatePlan(
  path: string,
  options?: ValidateOptions
): Promise<ValidationResult>
```

**Parameters:**

```typescript
interface ValidateOptions {
  fix?: boolean;  // Attempt to fix issues
}
```

**Returns:**

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixed?: string[];
}

interface ValidationError {
  type: string;
  message: string;
  file?: string;
  line?: number;
}
```

**Example:**

```typescript
import { validatePlan } from '@planvokter/riotplan';

const result = await validatePlan('./my-feature', { fix: true });

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

if (result.fixed) {
  console.log('Fixed issues:', result.fixed);
}
```

## Status Management

### parseStatus

Parse STATUS.md file.

```typescript
function parseStatus(content: string): PlanState
```

**Example:**

```typescript
import { parseStatus } from '@planvokter/riotplan';
import { readFileSync } from 'fs';

const content = readFileSync('./my-feature/STATUS.md', 'utf-8');
const state = parseStatus(content);

console.log(state.status);      // 'in_progress'
console.log(state.currentStep); // 3
console.log(state.progress);    // 45
```

### generateStatus

Generate STATUS.md content from plan state.

```typescript
function generateStatus(plan: Plan): string
```

**Example:**

```typescript
import { generateStatus } from '@planvokter/riotplan';
import { writeFileSync } from 'fs';

const statusContent = generateStatus(plan);
writeFileSync('./my-feature/STATUS.md', statusContent);
```

## AI Generation

### generatePlanContent

Generate plan content using AI.

```typescript
async function generatePlanContent(
  description: string,
  options: GenerateOptions
): Promise<GeneratedPlan>
```

**Parameters:**

```typescript
interface GenerateOptions {
  steps?: number;
  provider?: string;
  model?: string;
  analysis?: string;
}
```

**Returns:**

```typescript
interface GeneratedPlan {
  summary: string;
  executionPlan: string;
  steps: GeneratedStep[];
}

interface GeneratedStep {
  number: number;
  title: string;
  content: string;
}
```

**Example:**

```typescript
import { generatePlanContent } from '@planvokter/riotplan';

const generated = await generatePlanContent(
  'Implement user authentication with JWT tokens',
  {
    steps: 6,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5'
  }
);

console.log(generated.summary);
console.log(generated.steps.length); // 6
```

## Utilities

### findPlan

Find a plan directory by searching up from current directory.

```typescript
function findPlan(startPath?: string): string | null
```

**Example:**

```typescript
import { findPlan } from '@planvokter/riotplan';

const planPath = findPlan();
if (planPath) {
  console.log('Found plan at:', planPath);
}
```

### isPlan

Check if a directory is a valid plan.

```typescript
function isPlan(path: string): boolean
```

**Example:**

```typescript
import { isPlan } from '@planvokter/riotplan';

if (isPlan('./my-feature')) {
  console.log('Valid plan directory');
}
```

## Error Handling

All async functions can throw these errors:

```typescript
class PlanNotFoundError extends Error {
  constructor(path: string);
}

class InvalidPlanError extends Error {
  constructor(path: string, reason: string);
}

class StepNotFoundError extends Error {
  constructor(stepNumber: number);
}

class ValidationError extends Error {
  constructor(errors: ValidationError[]);
}
```

**Example:**

```typescript
import { loadPlan, PlanNotFoundError } from '@planvokter/riotplan';

try {
  const plan = await loadPlan('./my-feature');
} catch (error) {
  if (error instanceof PlanNotFoundError) {
    console.error('Plan not found:', error.message);
  } else {
    throw error;
  }
}
```

## Next Steps

- [Programmatic Usage](programmatic-usage) - Detailed usage guide
- [Core Concepts](core-concepts) - Understanding plans and steps
- [Creating Plans](creating-plans) - Plan creation guide
