/**
 * Build Tool - Prepare caller-side generation instructions
 *
 * This tool no longer performs server-side AI generation or artifact writes.
 * It returns deterministic instructions for the calling LLM to:
 * 1) generate a plan JSON locally
 * 2) write artifacts via explicit write tools
 * 3) transition lifecycle to built when writes complete
 */

import { z } from "zod";
import { createHash } from "node:crypto";
import { dirname, resolve, relative, normalize, isAbsolute } from "node:path";
import { readdirSync } from "node:fs";
import { resolveSqlitePlanPath, formatError, createSuccess } from "./shared.js";
import {
    loadArtifacts,
    buildPlanPrompt,
    getPlanGenerationSystemPrompt,
    PLAN_GENERATION_RESPONSE_SCHEMA,
    type GenerationContext,
} from "@planvokter/riotplan-ai";
import type { McpTool, ToolResult, ToolExecutionContext, BuildInstructionPayload } from "../types.js";
import { readProjectBinding, resolveProjectContext } from "./project-binding-shared.js";
import { createSqliteProvider } from "@planvokter/riotplan-format";

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

function extractSectionContent(markdown: string, heading: string): string | null {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sectionMatch = markdown.match(new RegExp(`##\\s+${escapedHeading}\\s+([\\s\\S]+?)(?=\\n##\\s+|$)`));
    const content = sectionMatch?.[1]?.trim() || '';
    return content.length > 0 ? content : null;
}

function extractFirstSubstantialHeadingSection(markdown: string): string | null {
    const headingPattern = /^##\s+(.+)$/gm;
    let headingMatch = headingPattern.exec(markdown);
    while (headingMatch) {
        const heading = headingMatch[1].trim();
        const sectionContent = extractSectionContent(markdown, heading);
        if (sectionContent && sectionContent.length >= 20 && !/^_.*_$/.test(sectionContent)) {
            return sectionContent;
        }
        headingMatch = headingPattern.exec(markdown);
    }
    return null;
}

function extractFirstParagraph(markdown: string): string | null {
    const lines = markdown
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    const paragraphLines: string[] = [];
    for (const line of lines) {
        if (line.startsWith('#') || line.startsWith('- ') || line.startsWith('* ') || line.startsWith('|')) {
            if (paragraphLines.length > 0) break;
            continue;
        }
        if (/^_.*_$/.test(line)) continue;
        paragraphLines.push(line);
        if (paragraphLines.join(' ').length >= 20) {
            return paragraphLines.join(' ').trim();
        }
    }
    return paragraphLines.length > 0 ? paragraphLines.join(' ').trim() : null;
}

function extractDescriptionFromIdea(ideaContent: string): string | null {
    return (
        extractSectionContent(ideaContent, 'Core Concept') ||
        extractSectionContent(ideaContent, 'Problem') ||
        extractFirstSubstantialHeadingSection(ideaContent) ||
        extractFirstParagraph(ideaContent)
    );
}

function formatIdeaDiagnostic(planPath: string, artifacts: Awaited<ReturnType<typeof loadArtifacts>>): string {
    const diagnostics = artifacts.artifactDiagnostics;
    const names = (diagnostics?.detectedArtifacts || [])
        .map((item) => `${item.type}:${item.filename}`)
        .join(', ');
    return (
        `planId=${diagnostics?.planId || planPath}; ` +
        `ideaArtifactFound=${diagnostics?.hasIdeaArtifact ?? Boolean(artifacts.ideaContent)}; ` +
        `detectedArtifacts=${names || 'none'}`
    );
}

// Tool schema
export const BuildSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    description: z.string().optional().describe("Optional plan description (defaults to IDEA.md content)"),
    steps: z.number().optional().describe("Optional number of steps to generate"),
    includeCodebaseContext: z
        .boolean()
        .optional()
        .describe("Include project-root context hints for caller-side model prompting (default: true)"),
});

function createWriteProtocol(isSqlitePlan: boolean): BuildInstructionPayload["writeProtocol"] {
    return {
        mode: isSqlitePlan ? "sqlite" : "directory",
        requiredArtifacts: ["summary", "execution_plan", "status", "provenance", "steps"],
        requiredTools: {
            validate: "riotplan_build_validate_plan",
            artifact: "riotplan_build_write_artifact",
            step: "riotplan_build_write_step",
            transition: "riotplan_transition",
        },
        sequence: [
            "Call riotplan_build_validate_plan with generated plan JSON and capture validationStamp.",
            "Call riotplan_build_write_artifact for SUMMARY.md (type=summary) with validationStamp.",
            "Call riotplan_build_write_artifact for EXECUTION_PLAN.md (type=execution_plan) with validationStamp.",
            "Call riotplan_build_write_artifact for STATUS.md (type=status) with validationStamp.",
            "Write steps using riotplan_build_write_step in number order (set clearExisting=true on first step) with validationStamp.",
            "Call riotplan_build_write_artifact for PROVENANCE.md (type=provenance) with validationStamp.",
            "After all writes succeed, call riotplan_transition with stage='built'.",
        ],
        constraints: [
            "All writes are explicit; riotplan_build never writes files.",
            "Use project-relative paths in steps[*].filesChanged.",
            "Do not transition to built before artifact and step writes complete.",
            "Do not write any artifact unless riotplan_build_validate_plan returned success with a validationStamp.",
        ],
    };
}

function createValidationProtocol(projectRoot: string): BuildInstructionPayload["validationProtocol"] {
    return {
        requiredTopLevelFields: ["analysis", "summary", "approach", "successCriteria", "steps"],
        requiredStepFields: [
            "number",
            "title",
            "objective",
            "background",
            "tasks",
            "acceptanceCriteria",
            "testing",
            "filesChanged",
            "notes",
        ],
        filesChangedRule:
            "Normalize all filesChanged entries as repository-relative paths before writing step files.",
        filesChangedExamples: normalizeStepFilePaths(
            ["./src/mcp/tools/build.ts", `${projectRoot}/src/ai/generator.ts`],
            projectRoot,
        ),
        requiredGrounding: [
            "Every IDEA constraint must appear in analysis.constraintAnalysis and in step-level provenance or notes.",
            "If a selected approach exists, generated plan must explicitly implement that approach (analysis.approachAnalysis.selectedApproach).",
            "Every evidence item should be referenced in analysis.evidenceAnalysis or step provenance.evidenceUsed.",
        ],
        preWriteGate: {
            required: true,
            tool: "riotplan_build_validate_plan",
            stampField: "validationStamp",
            reason: "Ensures generated output is grounded in all available plan context before persistence.",
        },
    };
}

function sha256(value: string): string {
    return createHash("sha256").update(value, "utf-8").digest("hex");
}

// Tool implementation
export async function buildPlan(
    args: z.infer<typeof BuildSchema>,
    context: ToolExecutionContext,
): Promise<BuildInstructionPayload> {
    const planPath = resolveSqlitePlanPath(args, context);

    const provider = createSqliteProvider(planPath);
    const metadataResult = await provider.getMetadata();
    await provider.close();
    if (!metadataResult.success || !metadataResult.data) {
        throw new Error(metadataResult.error || "Failed to read SQLite plan metadata");
    }
    const currentStage = metadataResult.data.stage;
    const planName = metadataResult.data.name;
    
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
        // Extract description from idea artifact with fallbacks.
        if (artifacts.ideaContent) {
            const extracted = extractDescriptionFromIdea(artifacts.ideaContent);
            if (extracted) {
                description = extracted;
            } else {
                throw new Error(
                    "Could not extract description from idea artifact and no description provided. " +
                    `Diagnostics: ${formatIdeaDiagnostic(planPath, artifacts)}`
                );
            }
        } else {
            throw new Error(
                "Idea artifact not found and no description provided. " +
                "Add idea content (IDEA.md as a typed file in SQLite) " +
                "or pass description explicitly. " +
                `Diagnostics: ${formatIdeaDiagnostic(planPath, artifacts)}`
            );
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
    if (artifacts.lifecycleContent) {
        fullContext += "\n\n--- LIFECYCLE CONTEXT ---\n" + artifacts.lifecycleContent;
    }

    const generationContext: GenerationContext = {
        planName: planName || "Plan",
        description: fullContext,
        stepCount: args.steps,
        constraints: artifacts.constraints,
        questions: artifacts.questions,
        selectedApproach: artifacts.selectedApproach || undefined,
        evidence: artifacts.evidence,
        historyContext: artifacts.historyContext,
        ideaContent: artifacts.ideaContent || undefined,
        shapingContent: artifacts.shapingContent || undefined,
        catalystContent: artifacts.catalystContent,
    };

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

    const includeCodebaseContext = args.includeCodebaseContext ?? true;
    if (includeCodebaseContext) {
        generationContext.codebaseContext =
            `Project root: ${projectRoot}\n` +
            `Plan path: ${planPath}\n` +
            `Use repository-relative file paths in filesChanged.`;
    }

    const systemPrompt = getPlanGenerationSystemPrompt();
    const userPrompt = buildPlanPrompt(generationContext);
    const coverage = {
        planStage: currentStage,
        includedArtifacts: [
            {
                id: "idea",
                present: Boolean(artifacts.ideaContent),
                includedInPrompt: Boolean(artifacts.ideaContent),
                sizeBytes: artifacts.ideaContent ? Buffer.byteLength(artifacts.ideaContent, "utf-8") : 0,
            },
            {
                id: "shaping",
                present: Boolean(artifacts.shapingContent),
                includedInPrompt: Boolean(artifacts.shapingContent),
                sizeBytes: artifacts.shapingContent ? Buffer.byteLength(artifacts.shapingContent, "utf-8") : 0,
            },
            {
                id: "lifecycle",
                present: Boolean(artifacts.lifecycleContent),
                includedInPrompt: Boolean(artifacts.lifecycleContent),
                sizeBytes: artifacts.lifecycleContent ? Buffer.byteLength(artifacts.lifecycleContent, "utf-8") : 0,
            },
            {
                id: "constraints",
                present: artifacts.constraints.length > 0,
                includedInPrompt: artifacts.constraints.length > 0,
                itemCount: artifacts.constraints.length,
            },
            {
                id: "questions",
                present: artifacts.questions.length > 0,
                includedInPrompt: artifacts.questions.length > 0,
                itemCount: artifacts.questions.length,
            },
            {
                id: "selectedApproach",
                present: Boolean(artifacts.selectedApproach),
                includedInPrompt: Boolean(artifacts.selectedApproach),
            },
            {
                id: "evidence",
                present: artifacts.evidence.length > 0,
                includedInPrompt: artifacts.evidence.length > 0,
                itemCount: artifacts.evidence.length,
                sizeBytes: artifacts.evidence.reduce((acc, entry) => acc + Buffer.byteLength(entry.content || "", "utf-8"), 0),
            },
            {
                id: "history",
                present: artifacts.historyContext.totalEvents > 0,
                includedInPrompt: artifacts.historyContext.totalEvents > 0,
                itemCount: artifacts.historyContext.totalEvents,
            },
            {
                id: "catalysts",
                present: Boolean(artifacts.catalystContent?.appliedCatalysts?.length),
                includedInPrompt: Boolean(artifacts.catalystContent?.appliedCatalysts?.length),
                itemCount: artifacts.catalystContent?.appliedCatalysts?.length || 0,
            },
            {
                id: "codebaseContext",
                present: includeCodebaseContext,
                includedInPrompt: includeCodebaseContext,
                sizeBytes: generationContext.codebaseContext
                    ? Buffer.byteLength(generationContext.codebaseContext, "utf-8")
                    : 0,
            },
        ],
        coverageCounts: {
            constraints: artifacts.constraints.length,
            questions: artifacts.questions.length,
            evidence: artifacts.evidence.length,
            historyEvents: artifacts.historyContext.totalEvents,
            catalysts: artifacts.catalystContent?.appliedCatalysts?.length || 0,
        },
    } satisfies BuildInstructionPayload["contextCoverage"];

    const missingContext: BuildInstructionPayload["missingContext"] = [];
    if (!artifacts.ideaContent) {
        missingContext.push({
            artifact: "idea",
            severity: "required",
            reason: "IDEA context is required to ground plan generation.",
        });
    }
    if (currentStage === "shaping" && !artifacts.shapingContent) {
        missingContext.push({
            artifact: "shaping",
            severity: "required",
            reason: "SHAPING context is required when lifecycle stage is shaping.",
        });
    }
    if (!artifacts.lifecycleContent) {
        missingContext.push({
            artifact: "lifecycle",
            severity: "recommended",
            reason: "Lifecycle history helps preserve decision context.",
        });
    }

    const artifactSha256: Record<string, string> = {};
    if (artifacts.ideaContent) artifactSha256.idea = sha256(artifacts.ideaContent);
    if (artifacts.shapingContent) artifactSha256.shaping = sha256(artifacts.shapingContent);
    if (artifacts.lifecycleContent) artifactSha256.lifecycle = sha256(artifacts.lifecycleContent);
    artifactSha256.constraints = sha256(JSON.stringify(artifacts.constraints));
    artifactSha256.questions = sha256(JSON.stringify(artifacts.questions));
    artifactSha256.selectedApproach = sha256(JSON.stringify(artifacts.selectedApproach || null));
    artifactSha256.evidence = sha256(
        JSON.stringify(
            artifacts.evidence.map((entry) => ({ name: entry.name, size: entry.size, content: entry.content })),
        ),
    );
    artifactSha256.history = sha256(JSON.stringify(artifacts.historyContext));
    artifactSha256.catalysts = sha256(JSON.stringify(artifacts.catalystContent || null));
    if (generationContext.codebaseContext) {
        artifactSha256.codebaseContext = sha256(generationContext.codebaseContext);
    }

    return {
        planId: planPath,
        planName: generationContext.planName,
        currentStage,
        generationInstructions: {
            systemPrompt,
            userPrompt,
            responseSchema: PLAN_GENERATION_RESPONSE_SCHEMA,
            expectedStepCount: generationContext.stepCount || 5,
        },
        generationContext,
        contextCoverage: coverage,
        missingContext,
        inclusionProof: {
            planId: planPath,
            generatedAt: new Date().toISOString(),
            promptSha256: sha256(`${systemPrompt}\n\n${userPrompt}`),
            artifactSha256,
        },
        writeProtocol: createWriteProtocol(true),
        validationProtocol: createValidationProtocol(projectRoot),
    };
}

// Tool executor
async function executeBuild(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const validated = BuildSchema.parse(args);
        const instructions = await buildPlan(validated, context);
        return createSuccess(
            instructions,
            "Build instructions prepared. No files were written. Use riotplan_build_apply for one-shot persistence, or manually run validate + build-write tools + transition.",
        );
    } catch (error) {
        return formatError(error);
    }
}

// MCP Tool definition
export const buildTool: McpTool = {
    name: 'riotplan_build',
    description:
        '[RiotPlan] Prepare caller-side plan generation instructions from idea/shaping artifacts. ' +
        'This tool does not run server-side AI, does not write plan files, and does not transition lifecycle. ' +
        'Use riotplan_build_apply when you want one-shot persistence of generated outputs. ' +
        'It returns a canonical system prompt, user prompt, JSON schema, generation context, context coverage proof, and write/validation protocols ' +
        'so the calling LLM can generate steps locally, prove grounding, and persist artifacts explicitly through gated writes.',
    schema: {
        planId: z.string().optional().describe('Plan identifier (optional, defaults to current plan context)'),
        description: z.string().optional().describe('Optional plan description (defaults to IDEA.md content)'),
        steps: z.number().optional().describe('Optional number of steps to generate'),
        includeCodebaseContext: z
            .boolean()
            .optional()
            .describe('Include project-root context hints for caller-side prompting (default: true)'),
    },
    execute: executeBuild,
};
