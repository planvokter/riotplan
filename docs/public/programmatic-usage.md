# Programmatic Usage

Learn how to use RiotPlan programmatically in your Node.js applications.

## Installation

```bash
npm install @planvokter/riotplan
```

## Basic Usage

### Loading a Plan

```typescript
import { loadPlan } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

console.log(plan.metadata.code);     // 'my-feature'
console.log(plan.metadata.name);     // 'My Feature Implementation'
console.log(plan.state.status);      // 'in_progress'
console.log(plan.state.currentStep); // 3
console.log(plan.state.progress);    // 40 (percentage)
console.log(plan.steps.length);      // 8
```

### Creating a Plan

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
      acceptanceCriteria: ['All requirements documented']
    },
    {
      title: 'Security Design',
      description: 'Design authentication flow',
      tasks: ['Design JWT flow', 'Plan session management']
    },
    {
      title: 'Implementation',
      description: 'Build the authentication system',
      tasks: ['Implement endpoints', 'Add middleware']
    },
    {
      title: 'Testing',
      description: 'Write tests and verify security',
      tasks: ['Write unit tests', 'Write integration tests']
    },
    {
      title: 'Documentation',
      description: 'Document the system',
      tasks: ['API documentation', 'Security guidelines']
    }
  ]
});

console.log(`Created plan at: ${plan.files.prompt}`);
```

## Working with Steps

### Listing Steps

```typescript
import { loadPlan } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

// Get all steps
const allSteps = plan.steps;

// Get pending steps
const pendingSteps = plan.steps.filter(s => s.status === 'pending');

// Get completed steps
const completedSteps = plan.steps.filter(s => s.status === 'completed');

// Get current step
const currentStep = plan.steps.find(s => s.number === plan.state.currentStep);

console.log(`Total steps: ${allSteps.length}`);
console.log(`Pending: ${pendingSteps.length}`);
console.log(`Completed: ${completedSteps.length}`);
```

### Starting a Step

```typescript
import { loadPlan, startStep } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

// Start step 5
const updatedPlan = await startStep(plan, 5);

console.log(`Started step ${updatedPlan.state.currentStep}`);
```

### Completing a Step

```typescript
import { loadPlan, completeStep } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

// Complete step 5 with notes
const updatedPlan = await completeStep(plan, 5, {
  notes: 'All endpoints working correctly',
  duration: 7200000  // 2 hours in milliseconds
});

console.log(`Completed step 5`);
console.log(`Progress: ${updatedPlan.state.progress}%`);
```

### Adding Steps

```typescript
import { loadPlan, addStep } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

// Add step at end
const updatedPlan = await addStep(plan, {
  title: 'Integration Testing',
  description: 'Test all components together',
  tasks: ['Write integration tests', 'Run test suite'],
  acceptanceCriteria: ['All tests pass', 'Coverage > 80%']
});

// Add step after step 5
const updatedPlan2 = await addStep(plan, {
  title: 'Code Review',
  description: 'Review implementation',
  after: 5
});

// Add step at specific position
const updatedPlan3 = await addStep(plan, {
  title: 'Security Audit',
  description: 'Audit security',
  number: 7
});
```

## Executing Plans

### Resume Execution

```typescript
import { loadPlan, resumePlan } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

// Resume from current state
const result = await resumePlan(plan, {
  logger: console,
  skipFailed: false,
  executor: async (step) => {
    // Custom step execution logic
    console.log(`Executing step ${step.number}: ${step.title}`);
    
    // Your execution logic here
    // ...
    
    return {
      success: true,
      duration: 3600000
    };
  }
});

console.log(`Success: ${result.success}`);
console.log(`Completed steps: ${result.completedSteps.join(', ')}`);
console.log(`Duration: ${result.duration}ms`);
```

### Execute Single Step

```typescript
import { loadPlan, executeStep } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

// Execute step 3
const result = await executeStep(plan, 3, {
  logger: console,
  executor: async (step) => {
    // Your execution logic
    return { success: true };
  }
});

if (result.success) {
  console.log('Step completed successfully');
}
```

## Status Management

### Reading Status

```typescript
import { loadPlan } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

const { state } = plan;

console.log(`Status: ${state.status}`);
console.log(`Current step: ${state.currentStep}`);
console.log(`Progress: ${state.progress}%`);
console.log(`Started: ${state.started}`);
console.log(`Last updated: ${state.lastUpdated}`);
```

### Updating Status

```typescript
import { loadPlan, updatePlanState } from '@planvokter/riotplan';

const plan = await loadPlan('./prompts/my-feature');

const updatedPlan = await updatePlanState(plan, {
  status: 'blocked',
  notes: 'Waiting for API key from DevOps'
});
```

### Parsing STATUS.md

```typescript
import { parseStatus } from '@planvokter/riotplan';
import { readFileSync } from 'fs';

const content = readFileSync('./my-feature/STATUS.md', 'utf-8');
const state = parseStatus(content);

console.log(state.status);
console.log(state.currentStep);
console.log(state.progress);
```

### Generating STATUS.md

```typescript
import { generateStatus } from '@planvokter/riotplan';
import { writeFileSync } from 'fs';

const statusContent = generateStatus(plan);
writeFileSync('./my-feature/STATUS.md', statusContent);
```

## Validation

### Validate Plan Structure

```typescript
import { validatePlan } from '@planvokter/riotplan';

const result = await validatePlan('./prompts/my-feature', {
  fix: true  // Attempt to fix issues
});

if (!result.valid) {
  console.error('Validation errors:');
  result.errors.forEach(error => {
    console.error(`- ${error.message}`);
  });
}

if (result.warnings.length > 0) {
  console.warn('Warnings:');
  result.warnings.forEach(warning => {
    console.warn(`- ${warning.message}`);
  });
}

if (result.fixed) {
  console.log('Fixed issues:', result.fixed);
}
```

## AI Generation

### Generate Plan Content

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

console.log('Summary:', generated.summary);
console.log('Execution Plan:', generated.executionPlan);
console.log(`Generated ${generated.steps.length} steps`);

generated.steps.forEach(step => {
  console.log(`Step ${step.number}: ${step.title}`);
});
```

### Generate with Analysis

```typescript
import { generatePlanContent } from '@planvokter/riotplan';
import { readFileSync } from 'fs';

const analysis = readFileSync('./analysis/REQUIREMENTS.md', 'utf-8');

const generated = await generatePlanContent(
  'Implement user authentication',
  {
    steps: 8,
    provider: 'anthropic',
    analysis: analysis  // Use analysis for context
  }
);
```

## Error Handling

```typescript
import {
  loadPlan,
  PlanNotFoundError,
  InvalidPlanError,
  StepNotFoundError,
  ValidationError
} from '@planvokter/riotplan';

try {
  const plan = await loadPlan('./prompts/my-feature');
  
  // Work with plan
  
} catch (error) {
  if (error instanceof PlanNotFoundError) {
    console.error('Plan not found:', error.message);
  } else if (error instanceof InvalidPlanError) {
    console.error('Invalid plan:', error.message);
  } else if (error instanceof StepNotFoundError) {
    console.error('Step not found:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Validation failed:', error.errors);
  } else {
    throw error;
  }
}
```

## Utilities

### Find Plan Directory

```typescript
import { findPlan } from '@planvokter/riotplan';

// Search up from current directory
const planPath = findPlan();

if (planPath) {
  console.log('Found plan at:', planPath);
} else {
  console.log('No plan found');
}

// Search from specific directory
const planPath2 = findPlan('./src/features');
```

### Check if Directory is a Plan

```typescript
import { isPlan } from '@planvokter/riotplan';

if (isPlan('./my-feature')) {
  console.log('Valid plan directory');
} else {
  console.log('Not a plan directory');
}
```

## Integration Examples

### Express API

```typescript
import express from 'express';
import { loadPlan, startStep, completeStep } from '@planvokter/riotplan';

const app = express();

app.get('/plans/:code', async (req, res) => {
  try {
    const plan = await loadPlan(`./prompts/${req.params.code}`);
    res.json(plan);
  } catch (error) {
    res.status(404).json({ error: 'Plan not found' });
  }
});

app.post('/plans/:code/steps/:number/start', async (req, res) => {
  try {
    const plan = await loadPlan(`./prompts/${req.params.code}`);
    const updated = await startStep(plan, parseInt(req.params.number));
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { loadPlan, resumePlan } from '@planvokter/riotplan';

async function main() {
  const planPath = process.argv[2] || '.';
  
  const plan = await loadPlan(planPath);
  
  console.log(`Resuming plan: ${plan.metadata.name}`);
  console.log(`Current progress: ${plan.state.progress}%`);
  
  const result = await resumePlan(plan, {
    logger: console
  });
  
  if (result.success) {
    console.log('Plan completed successfully!');
  } else {
    console.error('Plan execution failed');
    process.exit(1);
  }
}

main().catch(console.error);
```

## Next Steps

- [API Reference](api-reference) - Complete API documentation
- [Core Concepts](core-concepts) - Understanding plans and steps
- [Creating Plans](creating-plans) - Plan creation guide
- [Managing Steps](managing-steps) - Working with steps
