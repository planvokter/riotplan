/**
 * Agent-Powered Plan Generator
 * 
 * Uses an AgentLoop with read-only codebase tools to generate plans
 * that are grounded in the actual project code. The agent explores
 * the codebase, reads files, searches for patterns, then calls
 * write_plan with a structured plan.
 * 
 * This replaces the one-shot LLM call in generator.ts with a multi-turn
 * agent session that produces higher-quality, codebase-aware plans.
 */

import { AgentLoop, ToolRegistry, ConversationManager } from '@kjerneverk/agentic';
import type { AgentProvider, Tool } from '@kjerneverk/agentic';
import { createRequest } from '@kjerneverk/execution';
import type { Provider } from '../types.js';
import type { GeneratedPlan, GenerationContext, GenerationResult, GenerationOptionsWithProgress } from './generator.js';
import { createWritePlanTool } from './tools/write-plan.js';
import {
    calculateTiering,
    applyEvidenceTiering,
    DEFAULT_TOKEN_BUDGET,
    type TokenBudget,
    type TieringDecision,
} from './tokens.js';

/**
 * Default max iterations for the agent loop.
 * The agent needs room to explore (read files, grep, query index)
 * but shouldn't run forever. 30 iterations is ~15 tool calls
 * which is enough to explore a medium codebase and generate a plan.
 */
const DEFAULT_MAX_ITERATIONS = 30;

/**
 * System prompt for the agent-powered plan generator.
 * 
 * This instructs the agent to explore the codebase using tools,
 * then generate a plan grounded in what it finds.
 */
const AGENT_SYSTEM_PROMPT = `You are an expert project planner generating a detailed execution plan. You have access to codebase tools that let you explore the actual project.

## Dual Audience

Your plan serves TWO audiences:

1. **A human reviewer** who wants to see your design thinking, judge your approach, and give feedback BEFORE implementation begins. They need sample code, interface sketches, and schema examples — enough to form an opinion and say "yes, that's the right approach" or "no, change X."

2. **An LLM executor** who will implement each step. They need precise file paths, interface names, and concrete task descriptions.

Both audiences need you to SHOW, not just TELL. Don't say "create a storage interface" — show a draft of the interface with key method signatures. Don't say "design a schema" — show the schema. You don't have to write every line, but include enough sample code that a reader can evaluate your design choices.

## Your Workflow

1. **EXPLORE the codebase** — Use your tools to understand the project:
   - **START with \`query_index\`** — it returns the full project structure, all packages, and exported symbols in a single call (the index is pre-built and cached, so this is instant). Use queries like "packages", "find file generator", or "export AgentLoop".
   - Then use \`read_file\` to examine specific interfaces, types, and implementations
   - Use \`grep\` to find usage patterns and references
   - Use \`file_outline\` to understand a file's structure without reading every line
   - Use \`list_files\` only if you need directory contents not covered by the index

2. **ANALYZE the artifacts** — Study the plan artifacts in the user message:
   - Constraints are NON-NEGOTIABLE — every one must be addressed
   - Evidence contains research and findings — use them to inform design
   - The selected approach defines the strategy — implement it, not an alternative
   - History shows how thinking evolved — respect past decisions

3. **DESIGN concrete steps with code examples** — Each step must:
   - Reference REAL file paths you verified with tools
   - Name ACTUAL interfaces, classes, and functions from the codebase
   - Include **sample code** in task descriptions: interface drafts, schema sketches, function signatures, config examples — enough for a human to review the design
   - Include provenance linking back to constraints and evidence

4. **SUBMIT the plan** — Call \`write_plan\` with the complete JSON

## What "Show, Don't Tell" Means in Practice

**BAD task description:**
"Create a StorageProvider interface with methods for reading and writing plan data"

**GOOD task description:**
"Create a StorageProvider interface in src/storage/types.ts:

\\\`\\\`\\\`typescript
export interface StorageProvider {
  readPlan(id: string): Promise<Plan>;
  writePlan(id: string, plan: Plan): Promise<void>;
  listPlans(): Promise<PlanMetadata[]>;
  readStep(planId: string, stepNumber: number): Promise<PlanStep>;
  writeStep(planId: string, step: PlanStep): Promise<void>;
}
\\\`\\\`\\\`

This interface mirrors the existing file-based operations in plan/loader.ts but abstracts the storage backend. The key design choice is passing PlanStep objects rather than raw markdown — the provider handles serialization."

The good version lets a human reviewer evaluate the interface design, method signatures, and data flow before any code is written.

## Critical Rules

- EXPLORE FIRST. Do NOT generate the plan without reading relevant code.
- Every file path in filesChanged MUST be a real file you verified exists.
- Every interface or type name MUST be verified in the codebase.
- Include CODE SAMPLES in task descriptions: interface sketches, schema drafts, function signatures, example configs. Use markdown code blocks.
- Be concrete: "Add a \`generatePlanWithAgent()\` function to \`src/ai/generator.ts\`" not "Add a new function to the generator"
- If write_plan returns an error, fix the issue and call it again.
- You MUST call write_plan exactly once with the complete plan when done.`;

/**
 * Adapt an execution Provider to an AgentProvider for use with AgentLoop.
 * 
 * The execution package uses Provider/Request/ProviderResponse.
 * The agentic package uses AgentProvider/AgentRequest/AgentProviderResponse.
 * This adapter bridges the two interfaces.
 */
function createAgentProvider(provider: Provider, model: string): AgentProvider {
    // We need createRequest from the execution package to build requests
    // that the provider understands
    return {
        name: provider.name,
        execute: async (request) => {
            const execRequest = createRequest(model);
            for (const msg of request.messages) {
                execRequest.addMessage(msg);
            }
            if (request.tools && request.tools.length > 0) {
                (execRequest as any).tools = request.tools;
            }
            const response = await provider.execute(execRequest);
            return {
                content: response.content,
                model: response.model,
                usage: response.usage ? {
                    inputTokens: response.usage.inputTokens,
                    outputTokens: response.usage.outputTokens,
                } : undefined,
                toolCalls: response.toolCalls,
            };
        },
        executeStream: async function* (request) {
            const execRequest = createRequest(model);
            for (const msg of request.messages) {
                execRequest.addMessage(msg);
            }
            if (request.tools && request.tools.length > 0) {
                (execRequest as any).tools = request.tools;
            }
            if ((provider as any).executeStream) {
                for await (const chunk of (provider as any).executeStream(execRequest)) {
                    if (chunk.type === 'text') {
                        yield { type: 'text' as const, text: chunk.text };
                    } else if (chunk.type === 'tool_call_start') {
                        yield {
                            type: 'tool_call_start' as const,
                            toolCall: {
                                id: chunk.toolCall?.id,
                                index: chunk.toolCall?.index,
                                name: chunk.toolCall?.name,
                            },
                        };
                    } else if (chunk.type === 'tool_call_delta') {
                        yield {
                            type: 'tool_call_delta' as const,
                            toolCall: {
                                id: chunk.toolCall?.id,
                                index: chunk.toolCall?.index,
                                argumentsDelta: chunk.toolCall?.argumentsDelta,
                            },
                        };
                    } else if (chunk.type === 'tool_call_end') {
                        yield {
                            type: 'tool_call_end' as const,
                            toolCall: {
                                id: chunk.toolCall?.id,
                                index: chunk.toolCall?.index,
                            },
                        };
                    } else if (chunk.type === 'usage') {
                        yield {
                            type: 'usage' as const,
                            usage: chunk.usage ? {
                                inputTokens: chunk.usage.inputTokens,
                                outputTokens: chunk.usage.outputTokens,
                            } : undefined,
                        };
                    } else if (chunk.type === 'done') {
                        yield { type: 'done' as const };
                    }
                }
            } else {
                // Fallback to non-streaming
                const response = await provider.execute(execRequest);
                yield { type: 'text' as const, text: response.content };
                yield { type: 'done' as const };
            }
        },
    };
}

/**
 * Build the user prompt for agent-powered generation.
 * 
 * Similar to buildArtifactAwarePrompt() in generator.ts but:
 * - Includes codebase context section if available
 * - Ends with "explore and call write_plan" instead of "output JSON"
 * - The agent has tools, so we tell it to use them
 */
function buildAgentUserPrompt(context: GenerationContext): string {
    const sections: string[] = [];

    // == PLAN NAME ==
    sections.push(`== PLAN NAME ==\n${context.planName}`);

    // == CORE CONCEPT ==
    let coreConcept = context.description;
    const contextMarker = coreConcept.indexOf('\n\n--- IDEA CONTEXT ---');
    if (contextMarker !== -1) {
        coreConcept = coreConcept.substring(0, contextMarker).trim();
    }
    sections.push(`== CORE CONCEPT ==\n${coreConcept}`);

    // == CONSTRAINTS (MUST HONOR ALL) ==
    if (context.constraints && context.constraints.length > 0) {
        const constraintsList = context.constraints
            .map((c, i) => `${i + 1}. ${c}`)
            .join('\n');
        sections.push(`== CONSTRAINTS (MUST HONOR ALL) ==
The following constraints are NON-NEGOTIABLE. Every constraint must be addressed by at least one step.

${constraintsList}`);
    }

    // == CATALYST CONSTRAINTS ==
    if (context.catalystContent?.constraints) {
        sections.push(`== CATALYST CONSTRAINTS ==
${context.catalystContent.constraints}`);
    }

    // == SELECTED APPROACH ==
    if (context.selectedApproach) {
        sections.push(`== SELECTED APPROACH ==
This approach was selected during shaping. Your plan MUST implement this approach.

**Name**: ${context.selectedApproach.name}
**Description**: ${context.selectedApproach.description}
**Reasoning**: ${context.selectedApproach.reasoning}`);
    }

    // == EVIDENCE ==
    if (context.evidence && context.evidence.length > 0) {
        const evidenceContent = context.evidence
            .map(e => `### ${e.name}\n${e.content.trim()}`)
            .join('\n\n');
        sections.push(`== EVIDENCE ==
Evidence gathered during exploration. Use these findings to inform step design.

${evidenceContent}`);
    }

    // == HISTORY CONTEXT ==
    if (context.historyContext && context.historyContext.recentEvents.length > 0) {
        const historyList = context.historyContext.recentEvents
            .map(e => `- [${e.type}] ${e.summary}`)
            .join('\n');
        sections.push(`== HISTORY CONTEXT ==
Recent events (${context.historyContext.totalEvents} total):

${historyList}`);
    }

    // == QUESTIONS ==
    if (context.questions && context.questions.length > 0) {
        const questionsList = context.questions
            .map((q, i) => `${i + 1}. ${q}`)
            .join('\n');
        sections.push(`== OPEN QUESTIONS ==
Consider these when designing steps.

${questionsList}`);
    }

    // == CATALYST sections ==
    if (context.catalystContent?.domainKnowledge) {
        sections.push(`== CATALYST DOMAIN KNOWLEDGE ==\n${context.catalystContent.domainKnowledge}`);
    }
    if (context.catalystContent?.processGuidance) {
        sections.push(`== CATALYST PROCESS GUIDANCE ==\n${context.catalystContent.processGuidance}`);
    }
    if (context.catalystContent?.outputTemplates) {
        sections.push(`== CATALYST OUTPUT TEMPLATES ==\n${context.catalystContent.outputTemplates}`);
    }

    // == CODEBASE CONTEXT ==
    if (context.codebaseContext) {
        sections.push(`== CODEBASE CONTEXT ==
${context.codebaseContext}`);
    }

    // == AGENT INSTRUCTIONS ==
    const stepCount = context.stepCount || 5;
    sections.push(`== YOUR TASK ==

Generate a ${stepCount}-step execution plan for this project.

**Step 1: Explore the codebase.** Start by calling \`query_index\` with query "packages" to see the full project structure (this is instant — the index is pre-built). Then use \`query_index\` to find specific files and exports, \`read_file\` to examine key interfaces, and \`grep\` to find usage patterns.

**Step 2: Call write_plan.** Once you understand the codebase well enough, call \`write_plan\` with the complete plan JSON. Include:
- analysis (constraintAnalysis, evidenceAnalysis, approachAnalysis, risks)
- summary, approach, successCriteria
- ${stepCount} steps, each with concrete tasks referencing real files

**IMPORTANT — Task descriptions must include sample code.** A human will review this plan before execution. Every task that introduces an interface, schema, config, or significant function should include a code sketch in its description using markdown code blocks. Don't write the full implementation — just enough for a person to judge the design: key method signatures, table schemas, type definitions, config formats. This is the plan's most important quality signal.

Every step's \`filesChanged\` must list actual files from the codebase. Every task must reference real interfaces and functions. No placeholders.`);

    return sections.join('\n\n');
}

/**
 * Generate a plan using an agent loop with codebase tools.
 * 
 * The agent explores the codebase using read-only tools, then calls
 * write_plan to submit the structured plan. This produces higher-quality
 * plans than the one-shot approach because the agent can:
 * - Read actual source files
 * - Search for patterns and references
 * - Understand the project structure
 * - Reference real file paths, interfaces, and functions
 * 
 * @param context - Generation context with artifacts and description
 * @param provider - Execution provider (will be adapted to AgentProvider)
 * @param codebaseTools - Read-only environment tools (read_file, grep, etc.)
 * @param options - Generation options including model and progress callback
 * @param projectRoot - Project root directory for tool working directory
 * @returns GenerationResult with the plan and tiering info
 */
export async function generatePlanWithAgent(
    context: GenerationContext,
    provider: Provider,
    codebaseTools: Tool[],
    options: GenerationOptionsWithProgress = {},
    projectRoot?: string,
): Promise<GenerationResult> {
    const { onProgress } = options;

    // Apply token budget tiering (same as one-shot path)
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
            budget,
        );

        if (context.evidence && context.evidence.length > 0) {
            const tieredEvidence = applyEvidenceTiering(context.evidence, tieringDecision);
            tieredContext = { ...context, evidence: tieredEvidence };
        }

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

    // Notify start
    onProgress?.({ type: 'started', message: 'Starting agent-powered plan generation...' });

    // Create the write_plan tool with connected promise
    const { tool: writePlanTool, planPromise } = createWritePlanTool();

    // Create tool registry with project root as working directory
    const workingDir = projectRoot || process.cwd();
    const toolRegistry = ToolRegistry.create({
        workingDirectory: workingDir,
    });

    // Register codebase tools + write_plan
    for (const tool of codebaseTools) {
        toolRegistry.register(tool);
    }
    toolRegistry.register(writePlanTool);

    // Create conversation manager with system prompt
    const conversation = ConversationManager.create();
    conversation.addSystemMessage(AGENT_SYSTEM_PROMPT);

    // Create agent provider adapter
    const model = options.model || 'claude-sonnet-4-20250514';
    const agentProvider = createAgentProvider(provider, model);

    // Create agent loop
    const agentLoop = AgentLoop.create({
        provider: agentProvider,
        toolRegistry,
        conversation,
        model,
        maxIterations: DEFAULT_MAX_ITERATIONS,
    });

    // Build the user prompt with artifacts
    const userPrompt = buildAgentUserPrompt(tieredContext);

    // Run the agent loop
    onProgress?.({ type: 'streaming', message: 'Agent exploring codebase...', charsReceived: 0 });

    let textContent = '';
    let toolCallCount = 0;
    let lastProgressUpdate = Date.now();

    // Race between the agent loop completing and planPromise resolving.
    // The agent loop yields chunks; when write_plan is called, planPromise resolves.
    const agentDone = (async () => {
        for await (const chunk of agentLoop.runStream(userPrompt)) {
            if (chunk.type === 'text' && chunk.text) {
                textContent += chunk.text;
            }
            if (chunk.type === 'tool_start' && chunk.tool) {
                toolCallCount++;
                const now = Date.now();
                if (now - lastProgressUpdate > 300) {
                    const toolName = chunk.tool.name;
                    let detail = '';
                    if (toolName === 'read_file' && chunk.tool.arguments?.path) {
                        detail = `: ${chunk.tool.arguments.path}`;
                    } else if (toolName === 'grep' && chunk.tool.arguments?.pattern) {
                        detail = `: "${chunk.tool.arguments.pattern}"`;
                    } else if (toolName === 'list_files' && chunk.tool.arguments?.path) {
                        detail = `: ${chunk.tool.arguments.path}`;
                    } else if (toolName === 'write_plan') {
                        detail = ' (submitting plan)';
                    }
                    onProgress?.({
                        type: 'streaming',
                        message: `Agent: ${toolName}${detail} (${toolCallCount} tool calls)`,
                        charsReceived: textContent.length,
                    });
                    lastProgressUpdate = now;
                }
            }
            if (chunk.type === 'tool_result' && chunk.tool) {
                const now = Date.now();
                if (now - lastProgressUpdate > 300) {
                    onProgress?.({
                        type: 'streaming',
                        message: `Agent: ${chunk.tool.name} complete (${toolCallCount} tool calls)`,
                        charsReceived: textContent.length,
                    });
                    lastProgressUpdate = now;
                }
            }
        }
    })();

    // Wait for either: plan submitted via write_plan, or agent loop finishes
    let plan: GeneratedPlan;
    try {
        // Use Promise.race: planPromise resolves when write_plan is called
        // agentDone resolves when the agent loop finishes all iterations
        const result = await Promise.race([
            planPromise.then(p => ({ type: 'plan' as const, plan: p })),
            agentDone.then(() => ({ type: 'done' as const, plan: null as any })),
        ]);

        if (result.type === 'plan') {
            plan = result.plan;
            // Agent loop may still be running (write_plan was called mid-conversation)
            // That's fine - the plan is already captured
        } else {
            // Agent finished without calling write_plan
            // Try to get the plan from the promise (it might have been resolved during the last iteration)
            try {
                plan = await Promise.race([
                    planPromise,
                    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
                ]);
            } catch {
                throw new Error(
                    `Agent completed ${toolCallCount} tool calls over ${DEFAULT_MAX_ITERATIONS} iterations ` +
                    `but did not call write_plan to submit the plan. ` +
                    `The agent may have run out of iterations. ` +
                    `Try increasing maxIterations or simplifying the plan scope.`
                );
            }
        }
    } catch (error) {
        // Clean up: reject the planPromise if it hasn't been resolved
        (writePlanTool as any)._rejectPlan?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }

    // Notify parsing/completion
    onProgress?.({ type: 'parsing', message: `Plan received with ${plan.steps.length} steps from ${toolCallCount} tool calls` });
    onProgress?.({ type: 'complete', message: 'Agent-powered plan generation complete' });

    return {
        plan,
        tiering: tieringDecision,
    };
}
