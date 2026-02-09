/**
 * AI Plan Generator
 * 
 * Generates plan content using LLM providers
 */

import type { Provider, Request, ExecutionOptions } from '../types.js';
import { 
    calculateTiering, 
    applyEvidenceTiering, 
    DEFAULT_TOKEN_BUDGET,
    type TokenBudget,
    type TieringDecision 
} from './tokens.js';

export interface GeneratedPlan {
    summary: string;
    approach: string;
    successCriteria: string;
    steps: GeneratedStep[];
    analysis?: PlanAnalysis;  // Optional for backward compatibility
}

export interface GenerationResult {
    plan: GeneratedPlan;
    tiering?: TieringDecision;
}

export interface PlanAnalysis {
    constraintAnalysis: ConstraintAnalysis[];
    evidenceAnalysis?: EvidenceAnalysis[];
    approachAnalysis?: ApproachAnalysis;
    risks?: string[];
}

export interface ConstraintAnalysis {
    constraint: string;
    understanding: string;
    plannedApproach: string;
}

export interface EvidenceAnalysis {
    evidenceFile: string;
    keyFindings: string;
    impactOnPlan: string;
}

export interface ApproachAnalysis {
    selectedApproach: string;
    commitments: string;
    implementationStrategy: string;
}

export interface GeneratedStep {
    number: number;
    title: string;
    objective: string;
    background: string;
    tasks: GeneratedTask[];
    acceptanceCriteria: string[];
    testing: string;
    filesChanged: string[];
    notes: string;
    provenance?: StepProvenance;  // Optional for backward compatibility
}

export interface StepProvenance {
    constraintsAddressed?: string[];
    evidenceUsed?: string[];
    rationale?: string;
}

export interface GeneratedTask {
    id: string;
    description: string;
}

export interface GenerationContext {
    planName: string;
    description: string;
    elaborations?: string[];
    stepCount?: number;
    // Structured artifact fields for artifact-aware generation
    constraints?: string[];
    questions?: string[];
    selectedApproach?: {
        name: string;
        description: string;
        reasoning: string;
    };
    evidence?: {
        name: string;
        content: string;  // full or summarized
        size: number;
    }[];
    historyContext?: {
        recentEvents: { type: string; timestamp: string; summary: string }[];
        totalEvents: number;
    };
    ideaContent?: string;
    shapingContent?: string;
    // Token budget configuration
    tokenBudget?: {
        maxTokens?: number;
        evidenceFullThreshold?: number;
        evidenceSummaryThreshold?: number;
        historyFullCount?: number;
        historyAbbreviatedCount?: number;
    };
    // Catalyst content for plan generation
    catalystContent?: {
        constraints: string;
        domainKnowledge: string;
        outputTemplates: string;
        processGuidance: string;
        questions: string;
        validationRules: string;
        appliedCatalysts: string[];  // IDs for traceability
    };
}

/**
 * Generate a plan using AI
 */
export async function generatePlan(
    context: GenerationContext,
    provider: Provider,
    options: ExecutionOptions = {}
): Promise<GenerationResult> {
    // Apply token budget tiering if artifacts are present
    let tieringDecision: TieringDecision | undefined;
    let tieredContext = context;
    
    if (context.constraints || context.evidence || context.historyContext) {
        const budget: TokenBudget = {
            ...DEFAULT_TOKEN_BUDGET,
            ...context.tokenBudget,
        };
        
        tieringDecision = calculateTiering(
            context.constraints || [],
            context.selectedApproach || null,
            context.evidence || [],
            context.historyContext?.recentEvents.length || 0,
            budget
        );
        
        // Apply evidence tiering
        if (context.evidence && context.evidence.length > 0) {
            const tieredEvidence = applyEvidenceTiering(context.evidence, tieringDecision);
            tieredContext = {
                ...context,
                evidence: tieredEvidence,
            };
        }
        
        // Apply history abbreviation if needed
        if (tieringDecision.historyAbbreviated && context.historyContext) {
            const abbreviatedCount = budget.historyAbbreviatedCount || 5;
            tieredContext = {
                ...tieredContext,
                historyContext: {
                    ...context.historyContext,
                    recentEvents: context.historyContext.recentEvents.slice(0, abbreviatedCount),
                },
            };
        }
    }
    
    const prompt = buildPlanPrompt(tieredContext);
    
    const request: Request = {
        model: options.model || 'claude-sonnet-4-5',
        messages: [
            {
                role: 'system',
                content: SYSTEM_PROMPT,
            },
            {
                role: 'user',
                content: prompt,
            },
        ],
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'plan_generation',
                description: 'Generate a detailed execution plan',
                schema: {
                    type: 'object',
                    properties: {
                        analysis: {
                            type: 'object',
                            properties: {
                                constraintAnalysis: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            constraint: { type: 'string' },
                                            understanding: { type: 'string' },
                                            plannedApproach: { type: 'string' },
                                        },
                                        required: ['constraint', 'understanding', 'plannedApproach'],
                                    },
                                },
                                evidenceAnalysis: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            evidenceFile: { type: 'string' },
                                            keyFindings: { type: 'string' },
                                            impactOnPlan: { type: 'string' },
                                        },
                                        required: ['evidenceFile', 'keyFindings', 'impactOnPlan'],
                                    },
                                },
                                approachAnalysis: {
                                    type: 'object',
                                    properties: {
                                        selectedApproach: { type: 'string' },
                                        commitments: { type: 'string' },
                                        implementationStrategy: { type: 'string' },
                                    },
                                },
                                risks: {
                                    type: 'array',
                                    items: { type: 'string' },
                                },
                            },
                            required: ['constraintAnalysis'],
                        },
                        summary: { type: 'string' },
                        approach: { type: 'string' },
                        successCriteria: { type: 'string' },
                        steps: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    number: { type: 'number' },
                                    title: { type: 'string' },
                                    objective: { type: 'string' },
                                    background: { type: 'string' },
                                    tasks: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string' },
                                                description: { type: 'string' },
                                            },
                                            required: ['id', 'description'],
                                        },
                                    },
                                    acceptanceCriteria: {
                                        type: 'array',
                                        items: { type: 'string' },
                                    },
                                    testing: { type: 'string' },
                                    filesChanged: {
                                        type: 'array',
                                        items: { type: 'string' },
                                    },
                                    notes: { type: 'string' },
                                    provenance: {
                                        type: 'object',
                                        properties: {
                                            constraintsAddressed: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                            evidenceUsed: {
                                                type: 'array',
                                                items: { type: 'string' },
                                            },
                                            rationale: { type: 'string' },
                                        },
                                    },
                                },
                                required: ['number', 'title', 'objective', 'background', 'tasks', 'acceptanceCriteria', 'testing', 'filesChanged', 'notes'],
                            },
                        },
                    },
                    required: ['analysis', 'summary', 'approach', 'successCriteria', 'steps'],
                },
            },
        },
        addMessage: function(message) {
            this.messages.push(message);
        },
    };

    const response = await provider.execute(request, options);
    
    const plan = parsePlanResponse(response.content, context.stepCount || 5);
    
    return {
        plan,
        tiering: tieringDecision,
    };
}

/**
 * System prompt for artifact-aware plan generation
 * 
 * This prompt establishes that plan generation must be grounded in the provided artifacts,
 * not general knowledge. Constraints are non-negotiable, evidence should inform design,
 * and the selected approach defines the implementation strategy.
 */
const SYSTEM_PROMPT = `You are an expert project planner generating an execution plan that MUST be grounded in the provided artifacts.

## Core Principles

1. **Constraints are non-negotiable**: Every constraint from IDEA.md MUST be addressed by at least one step. Do not ignore or work around constraints.

2. **Evidence informs design**: Evidence files contain research, analysis, code snippets, and findings gathered during idea exploration. Use this evidence to inform step design - reference specific findings, not general knowledge.

3. **Selected approach is the strategy**: If a selected approach is provided from SHAPING.md, your plan MUST implement that approach, not an alternative. The approach was chosen deliberately with tradeoffs considered.

4. **History shows evolution**: The history context shows how thinking evolved during exploration. Respect decisions that were made and questions that were answered.

5. **Be concrete, not generic**: Reference specific files, functions, code patterns from the evidence. Don't generate generic steps that could apply to any project.

## Output Requirements

- Generate steps that are directly traceable to the artifacts
- Each step should cite which constraints it addresses
- Reference evidence when it informs a step's design
- Be specific about files, functions, and code changes

CRITICAL: You must output ONLY valid JSON. Do not include any text before or after the JSON object. Ensure all strings are properly escaped.`;

/**
 * Build the user prompt for plan generation
 * 
 * If structured artifact fields are present (constraints, evidence, selectedApproach, history),
 * constructs a rich prompt with labeled sections. Otherwise, falls back to the simple
 * description-based prompt for backward compatibility.
 */
function buildPlanPrompt(context: GenerationContext): string {
    // Check if we have structured artifacts to use
    const hasStructuredArtifacts = 
        (context.constraints && context.constraints.length > 0) ||
        (context.evidence && context.evidence.length > 0) ||
        context.selectedApproach ||
        (context.historyContext && context.historyContext.recentEvents.length > 0);
    
    if (hasStructuredArtifacts) {
        return buildArtifactAwarePrompt(context);
    } else {
        return buildLegacyPrompt(context);
    }
}

/**
 * Build artifact-aware prompt with labeled sections
 */
function buildArtifactAwarePrompt(context: GenerationContext): string {
    const sections: string[] = [];
    
    // == PLAN NAME ==
    sections.push(`== PLAN NAME ==
${context.planName}`);
    
    // == CORE CONCEPT ==
    // Extract just the core concept, not the full IDEA.md dump
    let coreConcept = context.description;
    // If description contains the full context dump, try to extract just the first part
    const contextMarker = coreConcept.indexOf('\n\n--- IDEA CONTEXT ---');
    if (contextMarker !== -1) {
        coreConcept = coreConcept.substring(0, contextMarker).trim();
    }
    sections.push(`== CORE CONCEPT ==
${coreConcept}`);
    
    // == CONSTRAINTS (MUST HONOR ALL) ==
    if (context.constraints && context.constraints.length > 0) {
        const constraintsList = context.constraints
            .map((c, i) => `${i + 1}. ${c}`)
            .join('\n');
        sections.push(`== CONSTRAINTS (MUST HONOR ALL) ==
The following constraints are NON-NEGOTIABLE. Every constraint must be addressed by at least one step in the plan.

${constraintsList}`);
    }
    
    // == CATALYST CONSTRAINTS ==
    if (context.catalystContent?.constraints) {
        sections.push(`== CATALYST CONSTRAINTS ==
The following constraints come from applied catalysts and must also be honored:

${context.catalystContent.constraints}`);
    }
    
    // == SELECTED APPROACH ==
    if (context.selectedApproach) {
        sections.push(`== SELECTED APPROACH ==
This approach was selected during shaping. Your plan MUST implement this approach, not an alternative.

**Name**: ${context.selectedApproach.name}

**Description**: ${context.selectedApproach.description}

**Reasoning**: ${context.selectedApproach.reasoning}`);
    }
    
    // == EVIDENCE ==
    if (context.evidence && context.evidence.length > 0) {
        const evidenceContent = context.evidence
            .map(e => {
                const content = e.content.trim();
                const tiered = (e as any).tiered;
                
                let header = `### ${e.name}`;
                if (tiered === 'summarized') {
                    header += ' (summarized for token budget)';
                } else if (tiered === 'listOnly') {
                    header += ' (preview only - full content available)';
                }
                
                return `${header}\n${content}`;
            })
            .join('\n\n');
        sections.push(`== EVIDENCE ==
The following evidence was gathered during idea exploration. Use these findings to inform step design.

${evidenceContent}`);
    }
    
    // == HISTORY CONTEXT ==
    if (context.historyContext && context.historyContext.recentEvents.length > 0) {
        const historyList = context.historyContext.recentEvents
            .map(e => `- [${e.type}] ${e.summary}`)
            .join('\n');
        sections.push(`== HISTORY CONTEXT ==
Recent events from idea exploration (${context.historyContext.totalEvents} total events):

${historyList}`);
    }
    
    // == QUESTIONS (for context) ==
    if (context.questions && context.questions.length > 0) {
        const questionsList = context.questions
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n');
        sections.push(`== OPEN QUESTIONS ==
These questions were raised during exploration. Consider them when designing steps.

${questionsList}`);
    }
    
    // == CATALYST DOMAIN KNOWLEDGE ==
    if (context.catalystContent?.domainKnowledge) {
        sections.push(`== CATALYST DOMAIN KNOWLEDGE ==
The following domain knowledge comes from applied catalysts and provides context about the domain, organization, or technology:

${context.catalystContent.domainKnowledge}`);
    }
    
    // == CATALYST OUTPUT TEMPLATES ==
    if (context.catalystContent?.outputTemplates) {
        sections.push(`== CATALYST OUTPUT TEMPLATES ==
The following output templates define expected deliverables that the plan should produce:

${context.catalystContent.outputTemplates}`);
    }
    
    // == CATALYST PROCESS GUIDANCE ==
    if (context.catalystContent?.processGuidance) {
        sections.push(`== CATALYST PROCESS GUIDANCE ==
The following process guidance from applied catalysts should inform how the plan is structured:

${context.catalystContent.processGuidance}`);
    }
    
    // == CATALYST QUESTIONS ==
    if (context.catalystContent?.questions) {
        sections.push(`== CATALYST QUESTIONS ==
The following questions from applied catalysts should be considered during planning:

${context.catalystContent.questions}`);
    }
    
    // == CATALYST VALIDATION RULES ==
    if (context.catalystContent?.validationRules) {
        sections.push(`== CATALYST VALIDATION RULES ==
The following validation rules from applied catalysts define post-creation checks:

${context.catalystContent.validationRules}`);
    }
    
    // == APPLIED CATALYSTS ==
    if (context.catalystContent?.appliedCatalysts && context.catalystContent.appliedCatalysts.length > 0) {
        const catalystList = context.catalystContent.appliedCatalysts
            .map((id, i) => `${i + 1}. ${id}`)
            .join('\n');
        sections.push(`== APPLIED CATALYSTS ==
This plan was generated with the following catalysts applied (in order):

${catalystList}

The catalyst content above has influenced the constraints, domain knowledge, output expectations, and process guidance for this plan.`);
    }
    
    // == GENERATION INSTRUCTIONS ==
    sections.push(`== GENERATION INSTRUCTIONS ==

**CRITICAL: You must complete the 'analysis' section FIRST before generating steps.**

The analysis section demonstrates your understanding of the artifacts and serves as your reasoning gate. Fill it out completely:

1. **constraintAnalysis**: For EACH constraint listed above, provide:
   - constraint: The exact constraint text
   - understanding: What this constraint means and why it exists
   - plannedApproach: How you will address this constraint in the plan

2. **evidenceAnalysis** (if evidence provided): For each evidence file that informs the plan:
   - evidenceFile: The evidence file name
   - keyFindings: The most important findings from this evidence
   - impactOnPlan: How these findings will shape the implementation steps

3. **approachAnalysis** (if selected approach provided):
   - selectedApproach: The approach name
   - commitments: What this approach commits us to doing
   - implementationStrategy: How the steps will implement this approach

4. **risks**: Any risks or challenges you foresee in implementing this plan

**After completing the analysis, generate ${context.stepCount || 5} implementation steps following these requirements:**

1. **Address every constraint**: Each constraint from your analysis MUST be addressed by at least one step
2. **Implement the selected approach**: Follow the implementation strategy from your analysis
3. **Reference evidence**: Use the key findings from your evidence analysis to inform step design
4. **Be concrete**: Reference specific files, functions, and code patterns from the evidence
5. **Include provenance**: For each step, fill the provenance field with:
   - constraintsAddressed: List which constraints this step addresses
   - evidenceUsed: List which evidence files informed this step
   - rationale: Explain why this step exists and how it connects to the idea

For each step, provide:
- A clear title
- Objective (what this step accomplishes)
- Background (context and prerequisites, referencing evidence where relevant)
- Specific tasks (concrete actions, not generic placeholders)
- Acceptance criteria (measurable verification)
- Testing approach
- Files that will be changed
- Notes (including which constraints are addressed)

IMPORTANT: Output ONLY the JSON object, with no markdown formatting, no code blocks, no additional text.

JSON structure:
{
  "analysis": {
    "constraintAnalysis": [
      {
        "constraint": "exact constraint text",
        "understanding": "what this constraint means",
        "plannedApproach": "how the plan will address this"
      }
    ],
    "evidenceAnalysis": [
      {
        "evidenceFile": "evidence file name",
        "keyFindings": "important findings from this evidence",
        "impactOnPlan": "how these findings shape the plan"
      }
    ],
    "approachAnalysis": {
      "selectedApproach": "approach name",
      "commitments": "what this approach commits to",
      "implementationStrategy": "how steps will implement this"
    },
    "risks": ["risk 1", "risk 2"]
  },
  "summary": "executive summary explaining what this plan accomplishes and how it addresses the constraints",
  "approach": "how the plan implements the selected approach (or your chosen approach if none selected)",
  "successCriteria": "how we'll know all constraints are satisfied and the project is complete",
  "steps": [
    {
      "number": 1,
      "title": "Step Title",
      "objective": "what this step accomplishes",
      "background": "context, prerequisites, and relevant evidence",
      "tasks": [
        {"id": "01.1", "description": "specific task"},
        {"id": "01.2", "description": "another task"}
      ],
      "acceptanceCriteria": ["criterion 1", "criterion 2"],
      "testing": "how to verify this step",
      "filesChanged": ["file1.ts", "file2.ts"],
      "notes": "additional notes",
      "provenance": {
        "constraintsAddressed": ["constraint 1", "constraint 2"],
        "evidenceUsed": ["evidence file 1", "evidence file 2"],
        "rationale": "why this step exists and how it connects to the idea"
      }
    }
  ]
}`);
    
    return sections.join('\n\n');
}

/**
 * Build legacy prompt for backward compatibility
 * Used when no structured artifacts are present
 */
function buildLegacyPrompt(context: GenerationContext): string {
    let prompt = `Create a detailed execution plan for the following project:

**Project Name**: ${context.planName}

**Description**:
${context.description}
`;

    if (context.elaborations && context.elaborations.length > 0) {
        prompt += `\n**Additional Context**:\n`;
        context.elaborations.forEach((elab, i) => {
            prompt += `\n${i + 1}. ${elab}\n`;
        });
    }

    prompt += `\n**Requirements**:
- Generate ${context.stepCount || 5} steps
- Each step should be focused and achievable
- Provide specific tasks, not generic placeholders
- Include concrete acceptance criteria
- Consider what files or components will be affected

Please provide:
1. Executive Summary (2-3 paragraphs explaining what this plan accomplishes)
2. Approach (how you'll tackle this work, key decisions)
3. Success Criteria (how we'll know the project is complete)
4. Detailed steps with:
   - Step title
   - Objective (what this step accomplishes)
   - Background (context needed)
   - Tasks (specific actions to take)
   - Acceptance criteria (how to verify completion)
   - Testing approach
   - Files that will be changed
   - Any notes or considerations

IMPORTANT: Output ONLY the JSON object below, with no markdown formatting, no code blocks, no additional text. Ensure all strings use proper JSON escaping for quotes and newlines.

JSON structure:
{
  "summary": "executive summary text",
  "approach": "approach description",
  "successCriteria": "success criteria description",
  "steps": [
    {
      "number": 1,
      "title": "Step Title",
      "objective": "what this step accomplishes",
      "background": "context and prerequisites",
      "tasks": [
        {"id": "01.1", "description": "specific task"},
        {"id": "01.2", "description": "another task"}
      ],
      "acceptanceCriteria": ["criterion 1", "criterion 2"],
      "testing": "how to verify this step",
      "filesChanged": ["file1.ts", "file2.ts"],
      "notes": "additional notes"
    }
  ]
}`;

    return prompt;
}

/**
 * Parse the LLM response into a structured plan
 */
function parsePlanResponse(content: string, _stepCount: number): GeneratedPlan {
    try {
        // Try to extract JSON from markdown code blocks if present
        let jsonContent = content.trim();
        
        // Remove markdown code blocks
        // Use indexOf to avoid polynomial regex
        const startMarker = jsonContent.indexOf('```');
        if (startMarker !== -1) {
            const endMarker = jsonContent.indexOf('```', startMarker + 3);
            if (endMarker !== -1) {
                jsonContent = jsonContent.substring(startMarker + 3, endMarker).trim();
                // Remove optional language identifier (json)
                if (jsonContent.startsWith('json')) {
                    jsonContent = jsonContent.substring(4).trim();
                }
            }
        }
        
        // Try to find JSON object (first { to last })
        const firstBrace = jsonContent.indexOf('{');
        const lastBrace = jsonContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonContent = jsonContent.substring(firstBrace, lastBrace + 1);
        }
        
        let parsed;
        try {
            parsed = JSON.parse(jsonContent);
        } catch {
            // If JSON parsing fails, try to clean up common issues
            jsonContent = jsonContent
                .replace(/\n/g, '\\n')  // Escape newlines
                .replace(/\t/g, '\\t')  // Escape tabs
                .replace(/\r/g, '\\r'); // Escape carriage returns
            
            parsed = JSON.parse(jsonContent);
        }
        
        // Validate structure
        if (!parsed.summary || !parsed.approach || !parsed.successCriteria || !parsed.steps) {
            throw new Error('Invalid plan structure: missing required fields');
        }
        
        // Analysis field is optional for backward compatibility
        // If present, it should have at least constraintAnalysis
        if (parsed.analysis && !parsed.analysis.constraintAnalysis) {
            throw new Error('Invalid analysis structure: missing constraintAnalysis');
        }
        
        // Ensure we have the right number of steps
        // Note: AI may generate different number of steps than requested
        
        return parsed as GeneratedPlan;
    } catch (error) {
        throw new Error(`Failed to parse plan response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Format a generated plan into markdown content for SUMMARY.md
 */
export function formatSummary(plan: GeneratedPlan, planName: string): string {
    const title = planName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    
    return `# ${title} - Summary

## Executive Summary

${plan.summary}

## Approach

${plan.approach}

## Success Criteria

${plan.successCriteria}
`;
}

/**
 * Format step into markdown content
 */
export function formatStep(step: GeneratedStep): string {
    const num = String(step.number).padStart(2, '0');
    
    let content = `# Step ${num}: ${step.title}

## Objective

${step.objective}

## Background

${step.background}

## Tasks

`;

    step.tasks.forEach(task => {
        content += `### ${task.id} ${task.description}\n\n`;
    });

    content += `## Acceptance Criteria

`;
    step.acceptanceCriteria.forEach(criterion => {
        content += `- [ ] ${criterion}\n`;
    });

    content += `\n## Testing

${step.testing}

## Files Changed

`;
    step.filesChanged.forEach(file => {
        content += `- ${file}\n`;
    });

    if (step.notes) {
        content += `\n## Notes

${step.notes}
`;
    }

    return content;
}
