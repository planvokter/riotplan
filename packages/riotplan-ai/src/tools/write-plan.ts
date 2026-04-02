/**
 * write_plan tool - Agent calls this to submit a generated plan
 * 
 * Uses a factory pattern: createWritePlanTool() returns both the tool
 * (for the agent to call) and a promise (for the caller to await).
 * When the agent calls write_plan, it resolves the promise with the plan.
 */

import type { Tool } from '@kjerneverk/agentic';
import type { GeneratedPlan } from '../generator.js';

/**
 * Result of creating a write_plan tool
 */
export interface WritePlanToolResult {
    /** The tool to register with the agent's ToolRegistry */
    tool: Tool;
    /** Promise that resolves when the agent calls write_plan */
    planPromise: Promise<GeneratedPlan>;
}

/**
 * Create a write_plan tool with a connected promise.
 * 
 * The caller awaits `planPromise` while the agent explores the codebase.
 * When the agent is ready, it calls `write_plan` with the plan JSON,
 * which resolves the promise and returns the plan to the caller.
 */
export function createWritePlanTool(): WritePlanToolResult {
    let resolvePlan: (plan: GeneratedPlan) => void;
    let rejectPlan: (error: Error) => void;
    
    const planPromise = new Promise<GeneratedPlan>((resolve, reject) => {
        resolvePlan = resolve;
        rejectPlan = reject;
    });

    const tool: Tool = {
        name: 'write_plan',
        description: `Submit the completed execution plan. Call this ONCE when you have finished exploring the codebase and are ready to submit your plan.

The plan_json parameter must be a valid JSON string with this structure:
{
  "analysis": {
    "constraintAnalysis": [{ "constraint": "...", "understanding": "...", "plannedApproach": "..." }],
    "evidenceAnalysis": [{ "evidenceFile": "...", "keyFindings": "...", "impactOnPlan": "..." }],
    "approachAnalysis": { "selectedApproach": "...", "commitments": "...", "implementationStrategy": "..." },
    "risks": ["..."]
  },
  "summary": "Executive summary of what this plan accomplishes",
  "approach": "How the plan implements the selected approach",
  "successCriteria": "How we'll know the project is complete",
  "steps": [{
    "number": 1,
    "title": "Step Title",
    "objective": "What this step accomplishes",
    "background": "Context, prerequisites, and relevant evidence",
    "tasks": [{ "id": "01.1", "description": "Specific task with file paths and code references" }],
    "acceptanceCriteria": ["Measurable criterion 1"],
    "testing": "How to verify this step",
    "filesChanged": ["src/actual/file.ts"],
    "notes": "Additional notes",
    "provenance": {
      "constraintsAddressed": ["constraint text"],
      "evidenceUsed": ["evidence file"],
      "rationale": "Why this step exists"
    }
  }]
}

IMPORTANT: Every step MUST include real file paths in filesChanged, reference actual interfaces/classes by name, and describe concrete code changes based on your codebase exploration.`,
        parameters: {
            type: 'object',
            properties: {
                plan_json: {
                    type: 'string',
                    description: 'The complete plan as a JSON string matching the GeneratedPlan schema described above.',
                },
            },
            required: ['plan_json'],
        },
        category: 'planning',
        cost: 'cheap',
        execute: async (params: { plan_json: string }) => {
            try {
                const parsed = JSON.parse(params.plan_json);
                
                // Validate required top-level fields
                if (!parsed.summary || !parsed.approach || !parsed.successCriteria || !parsed.steps) {
                    const missing = [];
                    if (!parsed.summary) missing.push('summary');
                    if (!parsed.approach) missing.push('approach');
                    if (!parsed.successCriteria) missing.push('successCriteria');
                    if (!parsed.steps) missing.push('steps');
                    return `Error: Missing required fields: ${missing.join(', ')}. Please include all required fields and call write_plan again.`;
                }
                
                // Validate steps array
                if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
                    return 'Error: steps must be a non-empty array. Please generate at least one step and call write_plan again.';
                }
                
                // Validate each step has required fields
                for (const step of parsed.steps) {
                    if (!step.number || !step.title || !step.objective) {
                        return `Error: Step ${step.number || '?'} is missing required fields (number, title, objective). Please fix and call write_plan again.`;
                    }
                    if (!step.tasks || !Array.isArray(step.tasks) || step.tasks.length === 0) {
                        return `Error: Step ${step.number} has no tasks. Each step must have at least one concrete task. Please fix and call write_plan again.`;
                    }
                    if (!step.filesChanged || !Array.isArray(step.filesChanged) || step.filesChanged.length === 0) {
                        return `Error: Step ${step.number} has no filesChanged. Each step must list specific files that will be modified. Use your codebase exploration to identify real file paths. Please fix and call write_plan again.`;
                    }
                }
                
                // Plan is valid - resolve the promise
                resolvePlan!(parsed as GeneratedPlan);
                
                return `Plan accepted with ${parsed.steps.length} steps. Plan generation complete.`;
            } catch (parseError) {
                if (parseError instanceof SyntaxError) {
                    return `Error: Invalid JSON in plan_json. ${parseError.message}. Please fix the JSON and call write_plan again.`;
                }
                return `Error: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Please fix and call write_plan again.`;
            }
        },
    };

    // Attach reject for timeout cleanup
    (tool as any)._rejectPlan = rejectPlan!;

    return { tool, planPromise };
}
