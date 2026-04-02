/**
 * Build Write Tools - Persist caller-generated build artifacts
 *
 * These tools are explicitly write-only. They do not generate AI content.
 */

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { createSqliteProvider } from "@planvokter/riotplan-format";
import type { McpTool, ToolResult, ToolExecutionContext } from "../types.js";
import { resolveSqlitePlanPath, formatError, createSuccess } from "./shared.js";
import { loadArtifacts } from "@planvokter/riotplan-ai";
import { transitionStage } from "./transition.js";

const ArtifactTypeSchema = z.enum(["summary", "execution_plan", "status", "provenance"]);

const BuildWriteArtifactSchema = z.object({
    planId: z.string().optional().describe("Plan identifier (defaults to current plan context)"),
    type: ArtifactTypeSchema.describe("Artifact type to write"),
    content: z.string().describe("Full markdown content for the artifact"),
    validationStamp: z.string().min(1).describe("Validation stamp from riotplan_build_validate_plan"),
});

const BuildWriteStepSchema = z.object({
    planId: z.string().optional().describe("Plan identifier (defaults to current plan context)"),
    step: z.number().int().min(1).describe("Step number"),
    title: z.string().min(1).describe("Step title"),
    content: z.string().describe("Full markdown content for the step file"),
    validationStamp: z.string().min(1).describe("Validation stamp from riotplan_build_validate_plan"),
    clearExisting: z
        .boolean()
        .optional()
        .describe("If true, clears existing step storage before writing this step (recommended for first step only)"),
});

const BuildValidatePlanSchema = z.object({
    planId: z.string().optional().describe("Plan identifier (defaults to current plan context)"),
    generatedPlan: z.record(z.string(), z.any()).describe("Caller-generated plan JSON from riotplan_build instructions"),
});

const BuildApplySchema = z.object({
    planId: z.string().optional().describe("Plan identifier (defaults to current plan context)"),
    generatedPlan: z.record(z.string(), z.any()).describe("Caller-generated plan JSON from riotplan_build instructions"),
    reason: z.string().optional().describe("Optional lifecycle transition reason"),
});

const validationStamps = new Map<string, { planPath: string; issuedAt: number }>();
const STAMP_TTL_MS = 30 * 60 * 1000;

function assertValidStamp(planPath: string, stamp: string): void {
    const record = validationStamps.get(stamp);
    if (!record) {
        throw new Error("Invalid validationStamp. Call riotplan_build_validate_plan before writing artifacts.");
    }
    if (record.planPath !== planPath) {
        throw new Error("validationStamp does not belong to this plan.");
    }
    if (Date.now() - record.issuedAt > STAMP_TTL_MS) {
        validationStamps.delete(stamp);
        throw new Error("validationStamp has expired. Re-run riotplan_build_validate_plan.");
    }
}

function collectStepProvenance(plan: Record<string, any>): { constraints: string[]; evidence: string[] } {
    const steps = Array.isArray(plan.steps) ? plan.steps : [];
    const constraints = new Set<string>();
    const evidence = new Set<string>();
    for (const step of steps) {
        const provenance = step?.provenance || {};
        const stepConstraints = Array.isArray(provenance.constraintsAddressed) ? provenance.constraintsAddressed : [];
        const stepEvidence = Array.isArray(provenance.evidenceUsed) ? provenance.evidenceUsed : [];
        for (const item of stepConstraints) {
            if (typeof item === "string" && item.trim()) constraints.add(item.trim());
        }
        for (const item of stepEvidence) {
            if (typeof item === "string" && item.trim()) evidence.add(item.trim());
        }
    }
    return { constraints: [...constraints], evidence: [...evidence] };
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
    return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function executeBuildValidatePlan(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = BuildValidatePlanSchema.parse(args);
        const planPath = resolveSqlitePlanPath(args, context);
        const generatedPlan = validated.generatedPlan;

        const requiredTopLevel = ["analysis", "summary", "approach", "successCriteria", "steps"];
        const missingTopLevel = requiredTopLevel.filter((field) => generatedPlan[field] === undefined);
        if (missingTopLevel.length > 0) {
            throw new Error(`Generated plan missing required fields: ${missingTopLevel.join(", ")}`);
        }
        if (!Array.isArray(generatedPlan.steps) || generatedPlan.steps.length === 0) {
            throw new Error("Generated plan must include at least one step.");
        }

        const artifacts = await loadArtifacts(planPath);
        const analysis = typeof generatedPlan.analysis === "object" && generatedPlan.analysis ? generatedPlan.analysis : {};
        const constraintAnalysis = Array.isArray((analysis as any).constraintAnalysis) ? (analysis as any).constraintAnalysis : [];
        const evidenceAnalysis = Array.isArray((analysis as any).evidenceAnalysis) ? (analysis as any).evidenceAnalysis : [];
        const approachAnalysis = typeof (analysis as any).approachAnalysis === "object" && (analysis as any).approachAnalysis
            ? (analysis as any).approachAnalysis
            : {};

        const analyzedConstraints = new Set<string>();
        for (const row of constraintAnalysis) {
            const value = typeof row?.constraint === "string" ? row.constraint.trim() : "";
            if (value) analyzedConstraints.add(value);
        }

        const analyzedEvidence = new Set<string>();
        for (const row of evidenceAnalysis) {
            const value = typeof row?.evidenceFile === "string" ? row.evidenceFile.trim() : "";
            if (value) analyzedEvidence.add(value);
        }

        const provenance = collectStepProvenance(generatedPlan);
        const missingConstraints = artifacts.constraints.filter((constraint) => {
            const inAnalysis = analyzedConstraints.has(constraint);
            const inProvenance = provenance.constraints.some((item) => includesCaseInsensitive(item, constraint));
            return !inAnalysis && !inProvenance;
        });
        if (missingConstraints.length > 0) {
            throw new Error(
                `Generated plan is not grounded in all constraints. Missing: ${missingConstraints.join(" | ")}`,
            );
        }

        if (artifacts.selectedApproach?.name) {
            const selectedName = artifacts.selectedApproach.name;
            const analysisMatch =
                typeof approachAnalysis.selectedApproach === "string" &&
                includesCaseInsensitive(approachAnalysis.selectedApproach, selectedName);
            const approachTextMatch =
                typeof generatedPlan.approach === "string" &&
                includesCaseInsensitive(generatedPlan.approach, selectedName);
            if (!analysisMatch && !approachTextMatch) {
                throw new Error(
                    `Generated plan does not reference selected approach "${selectedName}" in analysis.approachAnalysis or approach text.`,
                );
            }
        }

        const missingEvidence = artifacts.evidence
            .map((entry) => entry.name)
            .filter((name) => !analyzedEvidence.has(name) && !provenance.evidence.some((item) => includesCaseInsensitive(item, name)));
        if (missingEvidence.length > 0) {
            throw new Error(
                `Generated plan does not reference all evidence items. Missing: ${missingEvidence.join(", ")}`,
            );
        }

        const validationStamp = randomUUID();
        validationStamps.set(validationStamp, { planPath, issuedAt: Date.now() });
        return createSuccess(
            {
                planId: planPath,
                validationStamp,
                validatedAt: new Date().toISOString(),
                checked: {
                    constraints: artifacts.constraints.length,
                    evidence: artifacts.evidence.length,
                    selectedApproach: artifacts.selectedApproach?.name || null,
                },
            },
            "Generated plan validated against full plan context. Use validationStamp for subsequent build-write calls.",
        );
    } catch (error) {
        return formatError(error);
    }
}

function artifactFilename(type: z.infer<typeof ArtifactTypeSchema>): string {
    if (type === "summary") return "SUMMARY.md";
    if (type === "execution_plan") return "EXECUTION_PLAN.md";
    if (type === "status") return "STATUS.md";
    return "PROVENANCE.md";
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function toHeading(value: unknown, fallback: string): string {
    if (typeof value !== "string") return fallback;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : fallback;
}

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function renderTasks(tasks: unknown): string {
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return "- (none)";
    }
    return tasks
        .map((task) => {
            const id = typeof task?.id === "string" ? task.id : "";
            const description = typeof task?.description === "string" ? task.description : "";
            const prefix = id ? `- ${id}:` : "-";
            return `${prefix} ${description || "task"}`;
        })
        .join("\n");
}

function renderList(values: string[]): string {
    if (values.length === 0) return "- (none)";
    return values.map((value) => `- ${value}`).join("\n");
}

function renderSummaryContent(generatedPlan: Record<string, any>): string {
    const summary = toHeading(generatedPlan.summary, "No summary provided.");
    const approach = toHeading(generatedPlan.approach, "No approach provided.");
    const successCriteria = toHeading(generatedPlan.successCriteria, "No success criteria provided.");
    return (
        "# Summary\n\n" +
        `${summary}\n\n` +
        "## Approach\n\n" +
        `${approach}\n\n` +
        "## Success Criteria\n\n" +
        `${successCriteria}\n`
    );
}

function renderExecutionPlanContent(generatedPlan: Record<string, any>): string {
    const steps = Array.isArray(generatedPlan.steps) ? generatedPlan.steps : [];
    const ordered = [...steps].sort((a, b) => Number(a?.number || 0) - Number(b?.number || 0));
    const lines = ordered.map((step) => {
        const number = Number(step?.number || 0);
        const title = toHeading(step?.title, `Step ${number}`);
        const objective = toHeading(step?.objective, "Objective not provided.");
        return `## Step ${number}: ${title}\n\n${objective}`;
    });
    return `# Execution Plan\n\n${lines.join("\n\n")}\n`;
}

function renderStatusContent(generatedPlan: Record<string, any>): string {
    const steps = Array.isArray(generatedPlan.steps) ? generatedPlan.steps : [];
    return (
        "# STATUS\n\n" +
        "- State: built\n" +
        "- Current Step: none started yet\n" +
        `- Progress: 0/${steps.length} complete\n` +
        "- Blockers: none\n" +
        "- Issues: none\n"
    );
}

function renderProvenanceContent(generatedPlan: Record<string, any>): string {
    const analysis = generatedPlan.analysis && typeof generatedPlan.analysis === "object" ? generatedPlan.analysis : {};
    let constraints: string[] = [];
    if (Array.isArray((analysis as any).constraintAnalysis)) {
        constraints = (analysis as any).constraintAnalysis
            .map((row: any) => (typeof row?.constraint === "string" ? row.constraint.trim() : ""))
            .filter((value: string) => value.length > 0);
    }
    return (
        "# PROVENANCE\n\n" +
        "## Constraint Coverage\n\n" +
        `${renderList(constraints)}\n\n` +
        "## Source\n\n" +
        "- generatedPlan submitted to `riotplan_build_apply`\n"
    );
}

function renderStepContent(step: Record<string, any>): string {
    const number = Number(step.number || 0);
    const title = toHeading(step.title, `Step ${number}`);
    const objective = toHeading(step.objective, "Objective not provided.");
    const background = toHeading(step.background, "Background not provided.");
    const acceptanceCriteria = asStringArray(step.acceptanceCriteria);
    const testing = toHeading(step.testing, "Testing approach not provided.");
    return (
        `# Step ${number}: ${title}\n\n` +
        "## Objective\n" +
        `${objective}\n\n` +
        "## Background\n" +
        `${background}\n\n` +
        "## Tasks\n" +
        `${renderTasks(step.tasks)}\n\n` +
        "## Acceptance Criteria\n" +
        `${renderList(acceptanceCriteria)}\n\n` +
        "## Testing\n" +
        `${testing}\n`
    );
}

async function executeBuildWriteArtifact(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = BuildWriteArtifactSchema.parse(args);
        const planPath = resolveSqlitePlanPath(args, context);
        assertValidStamp(planPath, validated.validationStamp);
        const filename = artifactFilename(validated.type);

        const now = new Date().toISOString();
        const provider = createSqliteProvider(planPath);
        try {
            await provider.saveFile({
                type: validated.type,
                filename,
                content: validated.content,
                createdAt: now,
                updatedAt: now,
            });
        } finally {
            await provider.close();
        }

        return createSuccess(
            { planId: planPath, type: validated.type, filename },
            `Wrote ${filename} using caller-provided content.`,
        );
    } catch (error) {
        return formatError(error);
    }
}

async function executeBuildWriteStep(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = BuildWriteStepSchema.parse(args);
        const planPath = resolveSqlitePlanPath(args, context);
        assertValidStamp(planPath, validated.validationStamp);
        const stepNum = validated.step.toString().padStart(2, "0");
        const safeSlug = slugify(validated.title) || `step-${validated.step}`;
        const filename = `${stepNum}-${safeSlug}.md`;

        const provider = createSqliteProvider(planPath);
        try {
            if (validated.clearExisting) {
                const existing = await provider.getSteps();
                if (existing.success && existing.data) {
                    for (const step of existing.data) {
                        await provider.deleteStep(step.number);
                    }
                }
            }
            const existingStepResult = await provider.getStep(validated.step);
            if (!existingStepResult.success) {
                throw new Error(existingStepResult.error || `Failed to check step ${validated.step}`);
            }

            if (existingStepResult.data) {
                const updateResult = await provider.updateStep(validated.step, {
                    code: safeSlug,
                    title: validated.title,
                    description: validated.title,
                    content: validated.content,
                });
                if (!updateResult.success) {
                    throw new Error(updateResult.error || `Failed to update step ${validated.step}`);
                }
            } else {
                const addResult = await provider.addStep({
                    number: validated.step,
                    code: safeSlug,
                    title: validated.title,
                    description: validated.title,
                    status: "pending",
                    content: validated.content,
                });
                if (!addResult.success) {
                    throw new Error(addResult.error || `Failed to write step ${validated.step}`);
                }
            }
        } finally {
            await provider.close();
        }

        return createSuccess(
            { planId: planPath, step: validated.step, title: validated.title, filename },
            `Wrote step ${validated.step} (${filename}) using caller-provided content.`,
        );
    } catch (error) {
        return formatError(error);
    }
}

async function executeBuildApply(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = BuildApplySchema.parse(args);
        const planPath = resolveSqlitePlanPath(validated, context);

        const validationResult = await executeBuildValidatePlan(
            {
                planId: validated.planId,
                generatedPlan: validated.generatedPlan,
            },
            context,
        );
        if (!validationResult.success || !validationResult.data?.validationStamp) {
            throw new Error(validationResult.error || "Failed to validate generated plan for apply");
        }
        const validationStamp = String(validationResult.data.validationStamp);

        const writeArtifact = async (
            type: z.infer<typeof ArtifactTypeSchema>,
            content: string,
        ): Promise<void> => {
            const result = await executeBuildWriteArtifact(
                { planId: validated.planId, type, content, validationStamp },
                context,
            );
            if (!result.success) {
                throw new Error(result.error || `Failed to write ${type} artifact`);
            }
        };

        await writeArtifact("summary", renderSummaryContent(validated.generatedPlan));
        await writeArtifact("execution_plan", renderExecutionPlanContent(validated.generatedPlan));
        await writeArtifact("status", renderStatusContent(validated.generatedPlan));

        const generatedSteps = Array.isArray(validated.generatedPlan.steps) ? validated.generatedPlan.steps : [];
        const orderedSteps = [...generatedSteps].sort((a, b) => Number(a?.number || 0) - Number(b?.number || 0));
        for (let i = 0; i < orderedSteps.length; i++) {
            const step = orderedSteps[i] as Record<string, any>;
            const stepNumber = Number(step.number || i + 1);
            const stepTitle = toHeading(step.title, `Step ${stepNumber}`);
            const result = await executeBuildWriteStep(
                {
                    planId: validated.planId,
                    step: stepNumber,
                    title: stepTitle,
                    content: renderStepContent(step),
                    validationStamp,
                    clearExisting: i === 0,
                },
                context,
            );
            if (!result.success) {
                throw new Error(result.error || `Failed to write step ${stepNumber}`);
            }
        }

        await writeArtifact("provenance", renderProvenanceContent(validated.generatedPlan));

        await transitionStage(
            {
                planId: validated.planId,
                stage: "built",
                reason: validated.reason || "Applied generated plan via riotplan_build_apply",
            },
            context,
        );

        return createSuccess(
            {
                planId: planPath,
                applied: true,
                stepsWritten: orderedSteps.length,
                stage: "built",
            },
            "Applied generated plan: validated, persisted artifacts/steps, and transitioned to built.",
        );
    } catch (error) {
        return formatError(error);
    }
}

export const buildWriteArtifactTool: McpTool = {
    name: "riotplan_build_write_artifact",
    description:
        "Persist a caller-generated build artifact (SUMMARY.md, EXECUTION_PLAN.md, STATUS.md, or PROVENANCE.md). " +
        "Requires validationStamp from riotplan_build_validate_plan.",
    schema: BuildWriteArtifactSchema.shape,
    execute: executeBuildWriteArtifact,
};

export const buildWriteStepTool: McpTool = {
    name: "riotplan_build_write_step",
    description:
        "Persist a caller-generated step markdown file. " +
        "Requires validationStamp from riotplan_build_validate_plan. Use clearExisting=true only on first step write.",
    schema: BuildWriteStepSchema.shape,
    execute: executeBuildWriteStep,
};

export const buildValidatePlanTool: McpTool = {
    name: "riotplan_build_validate_plan",
    description:
        "Validate caller-generated plan JSON against full RiotPlan context (constraints, selected approach, evidence) " +
        "and issue a validationStamp required by build-write tools.",
    schema: BuildValidatePlanSchema.shape,
    execute: executeBuildValidatePlan,
};

export const buildApplyTool: McpTool = {
    name: "riotplan_build_apply",
    description:
        "One-shot build apply flow. Validates generated plan JSON, writes SUMMARY/EXECUTION_PLAN/STATUS/PROVENANCE and steps, " +
        "then transitions lifecycle to built.",
    schema: BuildApplySchema.shape,
    execute: executeBuildApply,
};

