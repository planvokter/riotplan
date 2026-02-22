/**
 * Build Tool - Build plan from idea/shaping directory
 * 
 * Supports two generation modes:
 * - Agent mode: Uses an AgentLoop with read-only codebase tools for higher quality
 * - One-shot mode: Single LLM call (fallback when tools unavailable)
 */

import { z } from "zod";
import { join, basename, dirname, resolve, relative, normalize, isAbsolute } from "node:path";
import { readFile, writeFile, mkdir, rm, readdir as readdirAsync } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { resolveDirectory, formatError, createSuccess, formatDate, ensurePlanManifest } from "./shared.js";
import { transitionStage } from "./transition.js";
import { generatePlan } from "../../ai/generator.js";
import { generatePlanWithAgent } from "../../ai/agent-generator.js";
import { loadProvider } from "../../ai/provider-loader.js";
import { loadArtifacts } from "../../ai/artifacts.js";
import { validatePlan } from "../../ai/validation.js";
import { generateProvenanceMarkdown } from "../../ai/provenance.js";
import { checkpointCreate } from "./history.js";
import type { McpTool, ToolResult, ToolExecutionContext } from "../types.js";
import type { GenerationContext } from "../../ai/generator.js";
import { readProjectBinding, resolveProjectContext } from "./project-binding-shared.js";

/**
 * Project root indicator files (language-agnostic).
 * Duplicated from common.ts to avoid heavy CLI dependencies.
 */
const PROJECT_ROOT_INDICATORS = [
    'package.json', 'Cargo.toml', 'pyproject.toml', 'setup.py',
    'go.mod', 'pom.xml', 'build.gradle', 'CMakeLists.txt',
    'Gemfile', 'Package.swift', '.git',
];

/**
 * Find the project root by walking up from a plan path.
 */
function findProjectRoot(startPath: string): string {
    let current = resolve(startPath);
    const maxDepth = 10;
    for (let i = 0; i < maxDepth; i++) {
        try {
            const entries = readdirSync(current);
            if (PROJECT_ROOT_INDICATORS.some(ind => entries.includes(ind))) {
                return current;
            }
        } catch { /* can't read dir */ }
        const parent = dirname(current);
        if (parent === current) break; // reached filesystem root
        current = parent;
    }
    return resolve(startPath); // fallback to start path
}

function normalizeSingleFilePath(filePath: string, basePath: string): string {
    let value = filePath.trim();
    if (!value) return '';

    // Tolerate markdown-y list entries returned by models.
    value = value.replace(/^[-*]\s+/, '');
    value = value.replace(/^`+|`+$/g, '');
    value = value.replace(/^"+|"+$/g, '');
    value = value.replace(/^'+|'+$/g, '');
    value = value.replace(/\\/g, '/');

    if (isAbsolute(value)) {
        value = relative(basePath, value);
    }

    const normalized = normalize(value).replace(/\\/g, '/');
    return normalized.replace(/^\.\//, '');
}

export function normalizeStepFilePaths(filesChanged: string[] | undefined, basePath: string): string[] {
    if (!filesChanged || filesChanged.length === 0) return [];
    const normalized = filesChanged
        .map((pathValue) => normalizeSingleFilePath(pathValue, basePath))
        .filter((pathValue) => pathValue.length > 0);
    return [...new Set(normalized)];
}

/**
 * Try to load read-only codebase tools for agent mode.
 * Returns null if tools are not available (e.g., in bundled MCP-only context).
 */
async function loadCodebaseTools(): Promise<any[] | null> {
    try {
        const mod = await import('../../cli/tools/environment/index.js');
        return mod.readOnlyEnvironmentTools || null;
    } catch {
        return null;
    }
}

// Tool schema
export const BuildSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    description: z.string().optional().describe("Optional plan description (defaults to IDEA.md content)"),
    steps: z.number().optional().describe("Optional number of steps to generate"),
    provider: z.string().optional().describe("AI provider (anthropic, openai, gemini)"),
    model: z.string().optional().describe("Specific model to use"),
    agentMode: z.boolean().optional().describe("Use agent-powered generation (auto-detected if not specified)"),
});

// Tool implementation
export async function buildPlan(args: z.infer<typeof BuildSchema>, context: ToolExecutionContext): Promise<string> {
    const planPath = resolveDirectory(args, context);
    const lifecycleFile = join(planPath, "LIFECYCLE.md");
    
    // Read and verify LIFECYCLE.md
    let lifecycle: string;
    try {
        lifecycle = await readFile(lifecycleFile, "utf-8");
    } catch {
        throw new Error(
            `Could not read LIFECYCLE.md at ${lifecycleFile}. ` +
            `This doesn't appear to be a valid idea/shaping directory. ` +
            `Use 'riotplan_create' to create a new plan instead.`
        );
    }
    
    // Extract current stage
    const stageMatch = lifecycle.match(/\*\*Stage\*\*: `(\w+)`/);
    const currentStage = stageMatch ? stageMatch[1] : "unknown";
    
    // Verify we're in idea or shaping stage
    if (currentStage !== "idea" && currentStage !== "shaping") {
        throw new Error(
            `Cannot build plan from '${currentStage}' stage. ` +
            `Build tool only works from 'idea' or 'shaping' stages. ` +
            `Current stage: ${currentStage}`
        );
    }
    
    // Load all plan artifacts using the shared artifact loader
    let artifacts;
    try {
        artifacts = await loadArtifacts(planPath);
    } catch (error) {
        throw new Error(`Failed to load plan artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Prepare description for AI generation
    let description = args.description;
    if (!description) {
        // Extract core concept from IDEA.md
        if (artifacts.ideaContent) {
            const conceptMatch = artifacts.ideaContent.match(/## Core Concept\s+([\s\S]+?)(?=\n## |$)/);
            if (conceptMatch) {
                description = conceptMatch[1].trim();
            } else {
                throw new Error("Could not extract description from IDEA.md and no description provided");
            }
        } else {
            throw new Error("IDEA.md not found and no description provided");
        }
    }
    
    // Build fallback context string (for backward compatibility and as fallback)
    let fullContext = description;
    if (artifacts.ideaContent) {
        fullContext += "\n\n--- IDEA CONTEXT ---\n" + artifacts.ideaContent;
    }
    if (artifacts.shapingContent) {
        fullContext += "\n\n--- SHAPING CONTEXT ---\n" + artifacts.shapingContent;
    }
    
    // Generate plan using AI
    // Session-aware provider loading: will use sampling if available, otherwise direct API
    const providerName = args.provider || 'anthropic';
    let provider;
    try {
        provider = await loadProvider({
            name: providerName,
            apiKey: process.env[`${providerName.toUpperCase()}_API_KEY`],
            session: context.session, // Pass session context for sampling detection
        });
    } catch {
        throw new Error(
            `AI provider not available. ` +
            `Install @kjerneverk/execution-${providerName} and set ${providerName.toUpperCase()}_API_KEY environment variable. ` +
            `Alternatively, use 'riotplan_step_add' to manually create plan steps.`
        );
    }
    
    const generationContext: GenerationContext = {
        planName: planPath.split('/').pop() || 'Plan',
        description: fullContext,
        stepCount: args.steps,
        // Structured artifact fields for artifact-aware generation
        constraints: artifacts.constraints,
        questions: artifacts.questions,
        selectedApproach: artifacts.selectedApproach || undefined,
        evidence: artifacts.evidence,
        historyContext: artifacts.historyContext,
        ideaContent: artifacts.ideaContent || undefined,
        shapingContent: artifacts.shapingContent || undefined,
    };
    
    // Resolve project root for path portability and codebase context.
    // Prefer explicit bound project context, then fall back to root detection from plan path.
    const binding = await readProjectBinding(planPath);
    const resolvedContext = await resolveProjectContext({
        planPath,
        cwd: context.workingDirectory,
        project: binding.project,
        contextConfig: context.config,
    });
    const projectRoot = resolvedContext.resolved && resolvedContext.projectRoot
        ? resolvedContext.projectRoot
        : findProjectRoot(planPath);
    try {
        const { queryIndexImpl, indexProjectImpl } = await import('../../cli/tools/environment/project-index.js');
        // Ensure index exists (cache hit if explore already built it)
        await indexProjectImpl({ path: projectRoot }, projectRoot);
        // Get a summary of packages and key files
        const packagesSummary = await queryIndexImpl({ path: projectRoot, query: 'packages' }, projectRoot);
        generationContext.codebaseContext = `Project root: ${projectRoot}\n\n${packagesSummary}`;
    } catch {
        // Index not available — agent can still use tools to explore
    }
    
    // Progress callback to show generation status
    // Uses the terminal spinner's sub-message if available (CLI context),
    // otherwise falls back to stderr dots (MCP context)
    const hasSpinner = typeof context.progressCallback === 'function';
    const onProgress = (event: { type: string; charsReceived?: number; message?: string }) => {
        if (hasSpinner && event.message) {
            // Update the terminal spinner's sub-message (no direct writes)
            context.progressCallback!(0, null, event.message);
        } else if (!hasSpinner && event.type === 'streaming' && event.charsReceived) {
            process.stderr.write('.');
        }
    };
    
    // Determine whether to use agent mode
    // Agent mode uses an AgentLoop with read-only codebase tools for higher quality plans
    let useAgentMode = args.agentMode;
    let codebaseTools: any[] | null = null;
    
    if (useAgentMode !== false) {
        // Try to load codebase tools for agent mode
        codebaseTools = await loadCodebaseTools();
        if (useAgentMode === undefined) {
            // Auto-detect: use agent mode if tools are available
            useAgentMode = codebaseTools !== null && codebaseTools.length > 0;
        }
    }
    
    let generationResult;
    let generationMode: string;
    
    if (useAgentMode && codebaseTools && codebaseTools.length > 0) {
        // Agent-powered generation: multi-turn agent with codebase exploration
        generationMode = 'agent';
        onProgress({ type: 'started', message: `agent mode — exploring ${projectRoot}` });
        
        try {
            generationResult = await generatePlanWithAgent(
                generationContext,
                provider,
                codebaseTools,
                { model: args.model, onProgress },
                projectRoot,
            );
        } catch {
            // Fall back to one-shot if agent fails
            onProgress({ type: 'streaming', message: `agent failed, falling back to one-shot` });
            generationMode = 'one-shot (agent fallback)';
            generationResult = await generatePlan(generationContext, provider, {
                model: args.model,
                onProgress,
            });
        }
    } else {
        // One-shot generation: single LLM call (original behavior)
        generationMode = 'one-shot';
        generationResult = await generatePlan(generationContext, provider, {
            model: args.model,
            onProgress,
        });
    }
    
    const { plan: result, tiering } = generationResult;
    
    // Run validation
    const validation = validatePlan(result, generationContext);
    
    // Build tiering summary for return message
    const tieringSummary: string[] = [];
    if (tiering) {
        tieringSummary.push(`Token budget: ${tiering.totalEstimatedTokens} estimated${tiering.budgetExceeded ? ' (exceeded)' : ''}`);
        if (tiering.evidenceTiered.full.length > 0) {
            tieringSummary.push(`Evidence (full): ${tiering.evidenceTiered.full.join(', ')}`);
        }
        if (tiering.evidenceTiered.summarized.length > 0) {
            tieringSummary.push(`Evidence (summarized): ${tiering.evidenceTiered.summarized.join(', ')}`);
        }
        if (tiering.evidenceTiered.listOnly.length > 0) {
            tieringSummary.push(`Evidence (preview only): ${tiering.evidenceTiered.listOnly.join(', ')}`);
        }
        if (tiering.historyAbbreviated) {
            tieringSummary.push(`History: abbreviated`);
        }
    }
    
    // Create plan files in existing directory
    
    // 1. Create SUMMARY.md
    let summaryContent = `# ${generationContext.planName}

## Overview

${result.summary}

## Goals

${description}

## Scope

### In Scope

- Implementation of planned features
- Testing and validation
- Documentation updates

### Out of Scope

- (To be determined during execution)

## Success Criteria

${result.steps.map((s, i) => `- [ ] Step ${i + 1}: ${s.title}`).join('\n')}`;

    // Add catalyst section if artifacts contain catalyst info
    if (artifacts.catalystContent?.appliedCatalysts && artifacts.catalystContent.appliedCatalysts.length > 0) {
        summaryContent += `

## Catalysts Applied

The following catalysts shaped this plan:

${artifacts.catalystContent.appliedCatalysts.map(id => `- ${id}`).join('\n')}`;
    }

    summaryContent += `

---

*Plan created: ${formatDate()}*
`;
    
    await writeFile(join(planPath, "SUMMARY.md"), summaryContent, "utf-8");
    
    // 2. Create EXECUTION_PLAN.md
    const executionContent = `# Execution Plan: ${generationContext.planName}

## Strategy

${result.approach}

## Prerequisites

- [ ] Understanding of requirements from IDEA.md
${artifacts.shapingContent ? '- [ ] Review selected approach from SHAPING.md\n' : ''}
## Steps

| Step | Name | Description |
|------|------|-------------|
${result.steps.map(s => `| ${s.number.toString().padStart(2, '0')} | ${s.title} | ${s.objective} |`).join('\n')}

## Quality Gates

After each step:
- [ ] Code compiles/runs
- [ ] Tests pass
- [ ] Documentation updated

## Notes

- Follow the step-by-step approach
- Update STATUS.md as you progress
- Use riotplan_step_start and riotplan_step_complete for tracking

---

*Last updated: ${formatDate()}*
`;
    
    await writeFile(join(planPath, "EXECUTION_PLAN.md"), executionContent, "utf-8");
    
    // 3. Create STATUS.md
    const statusContent = `# ${generationContext.planName} Status

## Current State

| Field | Value |
|-------|-------|
| **Status** | ⬜ PLANNING |
| **Current Step** | - |
| **Last Completed** | - |
| **Started** | - |
| **Last Updated** | ${formatDate()} |
| **Progress** | 0% (0/${result.steps.length} steps) |

## Step Progress

| Step | Name | Status | Started | Completed | Notes |
|------|------|--------|---------|-----------|-------|
${result.steps.map(s => `| ${s.number.toString().padStart(2, '0')} | ${s.title} | ⬜ | - | - | |`).join('\n')}

## Blockers

None currently.

## Issues

None currently.

## Notes

This plan was built from ${currentStage} stage.

---

## Execution Tracking

**To execute this plan with RiotPlan tracking:**

1. Use \`riotplan_step_start({ path, step: N })\` **before** starting each step
2. Complete the work for the step
3. Use \`riotplan_step_complete({ path, step: N })\` **after** completing each step

**For AI Assistants:** When executing this plan, always use RiotPlan's tracking tools. Don't just do the work - use \`riotplan_step_start\` and \`riotplan_step_complete\` to track progress. This ensures STATUS.md stays up-to-date and the plan can be resumed later.

---

*Last updated: ${formatDate()}*
`;
    
    await writeFile(join(planPath, "STATUS.md"), statusContent, "utf-8");
    
    // 4. Create plan/ directory with step files
    // Checkpoint previous build before replacing (so it's recoverable)
    const planDir = join(planPath, "plan");
    let checkpointName: string | undefined;
    try {
        const existingSteps = await readdirAsync(planDir).catch(() => []);
        if (existingSteps.length > 0) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            checkpointName = `pre-build-${ts}`;
            await checkpointCreate({
                planId: planPath,
                name: checkpointName,
                message: `Auto-checkpoint before rebuild (${existingSteps.length} step files)`,
                capturePrompt: false,
            });
        }
    } catch { /* checkpoint is best-effort */ }
    // Now clean and recreate
    try {
        await rm(planDir, { recursive: true, force: true });
    } catch { /* directory may not exist yet */ }
    await mkdir(planDir, { recursive: true });
    
    for (const step of result.steps) {
        const stepNum = step.number.toString().padStart(2, '0');
        const stepFile = join(planDir, `${stepNum}-${step.title.toLowerCase().replace(/\s+/g, '-')}.md`);
        const filesChanged = normalizeStepFilePaths(step.filesChanged, projectRoot);
        
        const stepContent = `# Step ${stepNum}: ${step.title}

## Objective

${step.objective}

## Background

${step.background || '_Add background context..._'}

## Tasks

${step.tasks && step.tasks.length > 0 ? step.tasks.map((t, i) => `### ${i + 1}. ${t.id}\n\n${t.description || '_Add task details..._'}`).join('\n\n') : '_Add specific tasks..._'}

## Acceptance Criteria

${step.acceptanceCriteria && step.acceptanceCriteria.length > 0 ? step.acceptanceCriteria.map(c => `- [ ] ${c}`).join('\n') : '- [ ] _Add acceptance criteria..._'}

## Testing

${step.testing || '_Add testing approach..._'}

## Files Changed

${filesChanged.length > 0 ? filesChanged.map(f => `- \`${f}\``).join('\n') : '- _List files that will be modified..._'}

## Notes

${step.notes || '_Add any additional notes..._'}
`;
        
        await writeFile(stepFile, stepContent, "utf-8");
    }
    
    // 5. Create PROVENANCE.md
    const provenanceContent = generateProvenanceMarkdown({
        plan: result,
        context: generationContext,
        validation,
        tiering,
        generatedAt: new Date(),
    });
    await writeFile(join(planPath, "PROVENANCE.md"), provenanceContent, "utf-8");
    
    // 6. Ensure plan.yaml manifest exists
    const planDirName = basename(planPath);
    const manifestCreated = await ensurePlanManifest(planPath, {
        id: planDirName,
        title: generationContext.planName,
        catalysts: artifacts.catalystContent?.appliedCatalysts,
    });
    
    // 7. Transition to "built" stage
    await transitionStage({
        planId: planPath,
        stage: "built",
        reason: `Plan built from ${currentStage} stage with ${result.steps.length} steps`,
    }, context);
    
    const validationSummary = validation.allWarnings.length > 0 
        ? `⚠️  Validation warnings: ${validation.allWarnings.length} (see PROVENANCE.md)`
        : `✅ Validation: all checks passed`;
    
    const tieringInfo = tieringSummary.length > 0 
        ? `\n\nToken Budget:\n${tieringSummary.map(s => `  - ${s}`).join('\n')}`
        : '';
    
    const manifestInfo = manifestCreated ? `- Created plan.yaml manifest\n` : '';
    
    return `✅ Plan built successfully!\n\n` +
        `- Generated ${result.steps.length} steps (${generationMode} mode)\n` +
        `- Created SUMMARY.md, EXECUTION_PLAN.md, STATUS.md, PROVENANCE.md\n` +
        `- Created plan/ directory with step files\n` +
        (checkpointName ? `- Previous build checkpointed as "${checkpointName}"\n` : '') +
        manifestInfo +
        `- Transitioned to 'built' stage\n` +
        `- Preserved existing IDEA.md, SHAPING.md, and history\n` +
        `- ${validationSummary}${tieringInfo}\n\n` +
        `Next: Use 'riotplan_step_start' to begin execution`;
}

// Tool executor
async function executeBuild(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const validated = BuildSchema.parse(args);
        const message = await buildPlan(validated, context);
        return createSuccess({ built: true }, message);
    } catch (error) {
        return formatError(error);
    }
}

// MCP Tool definition
export const buildTool: McpTool = {
    name: 'riotplan_build',
    description:
        '[RiotPlan] You are in plan development mode. Capture insights using RiotPlan tools—do not implement code changes. Ask before transitioning stages. ' +
        'Build a detailed plan from idea/shaping artifacts using AI generation. ' +
        'Reads ALL plan artifacts (IDEA.md, SHAPING.md, evidence, history, constraints) ' +
        'and generates steps grounded in the artifacts. Produces PROVENANCE.md showing ' +
        'how artifacts shaped the plan. Uses smart tiering for large artifact sets. ' +
        'Creates SUMMARY.md, EXECUTION_PLAN.md, STATUS.md, PROVENANCE.md, and plan/ directory with steps.',
    schema: {
        planId: z.string().optional().describe('Plan identifier (optional, defaults to current plan context)'),
        description: z.string().optional().describe('Optional plan description (defaults to IDEA.md content)'),
        steps: z.number().optional().describe('Optional number of steps to generate'),
        provider: z.string().optional().describe('AI provider (anthropic, openai, gemini)'),
        model: z.string().optional().describe('Specific model to use'),
        agentMode: z.boolean().optional().describe('Use agent-powered generation with codebase exploration (auto-detected if not specified)'),
    },
    execute: executeBuild,
};
