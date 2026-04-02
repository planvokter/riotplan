/**
 * MCP tools for Shaping stage management
 */

import { z } from "zod";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import { logEvent } from "./history.js";
import { transitionStage } from "./transition.js";
import {
    readShapingDoc as libReadShapingDoc,
    saveShapingDoc as libSaveShapingDoc,
    type PlanDoc,
} from "@planvokter/riotplan";

// Tool schemas
export const ShapingStartSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
});

export const ShapingAddApproachSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    name: z.string().describe("Name of the approach"),
    description: z.string().describe("Description of the approach"),
    tradeoffs: z.array(z.string()).optional().describe("List of tradeoffs (pros/cons)"),
    assumptions: z.array(z.string()).optional().describe("Key assumptions"),
});

export const ShapingAddFeedbackSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    feedback: z.string().describe("Feedback about the current shaping"),
});

export const ShapingAddEvidenceSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    evidencePath: z.string().describe("Path to evidence file"),
    description: z.string().optional().describe("Description of the evidence"),
    relatedTo: z.string().optional().describe("Which approach this evidence relates to"),
});

export const ShapingCompareSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
});

export const ShapingSelectSchema = z.object({
    planId: z.string().optional().describe("Plan identifier"),
    approach: z.string().describe("Name of the selected approach"),
    reason: z.string().describe("Reason for selecting this approach"),
});

type ShapingDoc = PlanDoc;

async function readShapingDoc(planPath: string): Promise<ShapingDoc | null> {
    return libReadShapingDoc(planPath);
}

async function saveShapingDoc(planPath: string, content: string): Promise<void> {
    return libSaveShapingDoc(planPath, content);
}

async function addShapingEvent(planPath: string, type: string, data: Record<string, unknown>): Promise<void> {
    await logEvent(planPath, {
        timestamp: formatTimestamp(),
        type: type as any,
        data,
    });
}

// Tool implementations

export async function shapingStart(args: z.infer<typeof ShapingStartSchema>): Promise<string> {
    const shapingPath = args.planId || process.cwd();
  
    // Create SHAPING.md
    const shapingContent = `# Shaping: [Name]

## Problem Statement

_What problem are we solving? What are we trying to achieve?_

## Approaches Considered

_Add approaches using riotplan_shaping({ action: "add_approach", ... })_

## Feedback

_Feedback will be added here as you provide it_

## Evidence

_Evidence will be added here to support decision-making_

## Key Decisions

_Decisions will be tracked here_

## Open Questions

- _What questions need answering?_

## Status

**Stage**: shaping
**Started**: ${formatTimestamp()}
**Next**: Select an approach and transition to 'built'
`;

    await saveShapingDoc(shapingPath, shapingContent);
    await transitionStage(
        {
            planId: shapingPath,
            stage: "shaping",
            reason: "Ready to explore approaches",
        },
        {
            workingDirectory: shapingPath,
        } as any
    );
  
    // Log event
    await addShapingEvent(shapingPath, 'shaping_started', {});
  
    return `✅ Shaping started\n\nNext steps:\n- Add approaches: riotplan_shaping({ action: "add_approach", ... })\n- Provide feedback: riotplan_shaping({ action: "add_feedback", ... })\n- Add evidence: riotplan_shaping({ action: "add_evidence", ... })\n- Compare approaches: riotplan_shaping({ action: "compare" })\n- When ready: riotplan_shaping({ action: "select", ... })`;
}

export async function shapingAddApproach(args: z.infer<typeof ShapingAddApproachSchema>): Promise<string> {
    const shapingPath = args.planId || process.cwd();
    const shapingDoc = await readShapingDoc(shapingPath);
    if (!shapingDoc) {
        throw new Error("Could not find SHAPING.md content. Start shaping first with riotplan_shaping({ action: \"start\" })");
    }
    let content = shapingDoc.content;
  
    const approachesSection = "## Approaches Considered";
    const approachesIndex = content.indexOf(approachesSection);
  
    if (approachesIndex === -1) {
        throw new Error("Could not find Approaches Considered section in SHAPING.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", approachesIndex + approachesSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    let approach = `\n### Approach: ${args.name}\n\n`;
    approach += `**Description**: ${args.description}\n\n`;
  
    if (args.tradeoffs && args.tradeoffs.length > 0) {
        approach += `**Tradeoffs**:\n`;
        args.tradeoffs.forEach(t => {
            approach += `- ${t}\n`;
        });
        approach += `\n`;
    }
  
    if (args.assumptions && args.assumptions.length > 0) {
        approach += `**Assumptions**:\n`;
        args.assumptions.forEach(a => {
            approach += `- ${a}\n`;
        });
        approach += `\n`;
    }
  
    content = content.slice(0, insertPoint) + approach + content.slice(insertPoint);
  
    await saveShapingDoc(shapingPath, content);
  
    // Log event
    await addShapingEvent(shapingPath, 'approach_added', {
        name: args.name,
        description: args.description,
        tradeoffs: args.tradeoffs,
        assumptions: args.assumptions,
    });
  
    return `✅ Approach added: ${args.name}`;
}

export async function shapingAddFeedback(args: z.infer<typeof ShapingAddFeedbackSchema>): Promise<string> {
    const shapingPath = args.planId || process.cwd();
    const shapingDoc = await readShapingDoc(shapingPath);
    if (!shapingDoc) {
        throw new Error("Could not find SHAPING.md content. Start shaping first with riotplan_shaping({ action: \"start\" })");
    }
    let content = shapingDoc.content;
  
    const feedbackSection = "## Feedback";
    const feedbackIndex = content.indexOf(feedbackSection);
  
    if (feedbackIndex === -1) {
        throw new Error("Could not find Feedback section in SHAPING.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", feedbackIndex + feedbackSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    const feedback = `\n### ${formatTimestamp()}\n\n${args.feedback}\n`;
    content = content.slice(0, insertPoint) + feedback + content.slice(insertPoint);
  
    await saveShapingDoc(shapingPath, content);
  
    // Log event
    await addShapingEvent(shapingPath, 'feedback_added', { feedback: args.feedback });
  
    return `✅ Feedback added`;
}

export async function shapingAddEvidence(args: z.infer<typeof ShapingAddEvidenceSchema>): Promise<string> {
    const shapingPath = args.planId || process.cwd();
    const shapingDoc = await readShapingDoc(shapingPath);
    if (!shapingDoc) {
        throw new Error("Could not find SHAPING.md content. Start shaping first with riotplan_shaping({ action: \"start\" })");
    }
    let content = shapingDoc.content;
  
    const evidenceSection = "## Evidence";
    const evidenceIndex = content.indexOf(evidenceSection);
  
    if (evidenceIndex === -1) {
        throw new Error("Could not find Evidence section in SHAPING.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", evidenceIndex + evidenceSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    let evidence = `\n- [${args.evidencePath}](${args.evidencePath})`;
    if (args.description) {
        evidence += ` - ${args.description}`;
    }
    if (args.relatedTo) {
        evidence += ` (relates to: ${args.relatedTo})`;
    }
    evidence += `\n`;
  
    content = content.slice(0, insertPoint) + evidence + content.slice(insertPoint);
  
    await saveShapingDoc(shapingPath, content);
  
    // Log event
    await addShapingEvent(shapingPath, 'evidence_added', {
        evidencePath: args.evidencePath,
        description: args.description,
        relatedTo: args.relatedTo,
    });
  
    return `✅ Evidence added`;
}

export async function shapingCompare(args: z.infer<typeof ShapingCompareSchema>): Promise<string> {
    const shapingPath = args.planId || process.cwd();
    const shapingDoc = await readShapingDoc(shapingPath);
    if (!shapingDoc) {
        return "No shaping content found. Start shaping first using riotplan_shaping({ action: \"start\" })";
    }
    const content = shapingDoc.content;
  
    // Extract approaches
    const approachesSection = content.indexOf("## Approaches Considered");
    const nextSection = content.indexOf("\n## ", approachesSection + 25);
    const approachesContent = content.slice(approachesSection, nextSection !== -1 ? nextSection : undefined);
  
    // Parse approaches (simple extraction)
    const approaches = approachesContent.match(/### Approach: (.+)/g) || [];
  
    if (approaches.length === 0) {
        return "No approaches found. Add approaches first using riotplan_shaping({ action: \"add_approach\", ... })";
    }
  
    let comparison = "## Approach Comparison\n\n";
    approaches.forEach((approach: string) => {
        const name = approach.replace("### Approach: ", "");
        comparison += `**${name}**\n`;
    
        // Find this approach's section
        const approachIndex = approachesContent.indexOf(approach);
        const nextApproach = approachesContent.indexOf("### Approach:", approachIndex + 1);
        const approachSection = approachesContent.slice(
            approachIndex,
            nextApproach !== -1 ? nextApproach : undefined
        );
    
        // Extract tradeoffs
        const tradeoffsMatch = approachSection.match(/\*\*Tradeoffs\*\*:\n((?:- .+\n)+)/);
        if (tradeoffsMatch) {
            comparison += tradeoffsMatch[1];
        }
    
        comparison += "\n";
    });
  
    // Log event
    await addShapingEvent(shapingPath, 'approach_compared', { approachCount: approaches.length });
  
    return comparison;
}

export async function shapingSelect(args: z.infer<typeof ShapingSelectSchema>): Promise<string> {
    const shapingPath = args.planId || process.cwd();
    const shapingDoc = await readShapingDoc(shapingPath);
    if (!shapingDoc) {
        throw new Error("Could not find SHAPING.md content. Start shaping first with riotplan_shaping({ action: \"start\" })");
    }
    let content = shapingDoc.content;
  
    // Add selection to Key Decisions
    const decisionsSection = "## Key Decisions";
    const decisionsIndex = content.indexOf(decisionsSection);
  
    if (decisionsIndex !== -1) {
        const nextSectionIndex = content.indexOf("\n## ", decisionsIndex + decisionsSection.length);
        const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    
        const decision = `\n**Selected Approach**: ${args.approach}\n\n**Reasoning**: ${args.reason}\n\n**Selected At**: ${formatTimestamp()}\n`;
        content = content.slice(0, insertPoint) + decision + content.slice(insertPoint);
    
        await saveShapingDoc(shapingPath, content);
    }
  
    // Log event
    await addShapingEvent(shapingPath, 'approach_selected', {
        approach: args.approach,
        reason: args.reason,
    });
  
    return `✅ Approach selected: ${args.approach}\n\n⚠️  IMPORTANT: You must now call riotplan_build to generate the detailed execution plan.\n\nThis will:\n- Create PROVENANCE.md (tracing how artifacts shaped the plan)\n- Create EXECUTION_PLAN.md (detailed step-by-step strategy)\n- Create SUMMARY.md (high-level overview)\n- Create STATUS.md (progress tracking)\n- Generate step files in plan/ directory\n- Transition to 'built' stage\n\nCall: riotplan_build({ planId: "${shapingPath}" })`;
}

// Tool executors for MCP
import type { ToolResult, ToolExecutionContext } from '../types.js';

export async function executeShapingStart(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingStartSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await shapingStart({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingAddApproach(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingAddApproachSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await shapingAddApproach({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingAddFeedback(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingAddFeedbackSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await shapingAddFeedback({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingAddEvidence(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingAddEvidenceSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await shapingAddEvidence({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingCompare(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingCompareSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await shapingCompare({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingSelect(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingSelectSchema.parse(args);
        const resolvedPath = resolveDirectory(args, context);
        const result = await shapingSelect({ ...validated, planId: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions for MCP
import type { McpTool } from '../types.js';

const ShapingActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("start"),
        planId: z.string().optional(),
    }),
    z.object({
        action: z.literal("add_approach"),
        planId: z.string().optional(),
        name: z.string(),
        description: z.string(),
        tradeoffs: z.array(z.string()).optional(),
        assumptions: z.array(z.string()).optional(),
    }),
    z.object({
        action: z.literal("add_feedback"),
        planId: z.string().optional(),
        feedback: z.string(),
    }),
    z.object({
        action: z.literal("add_evidence"),
        planId: z.string().optional(),
        evidencePath: z.string(),
        description: z.string().optional(),
        relatedTo: z.string().optional(),
    }),
    z.object({
        action: z.literal("compare"),
        planId: z.string().optional(),
    }),
    z.object({
        action: z.literal("select"),
        planId: z.string().optional(),
        approach: z.string(),
        reason: z.string(),
    }),
]);

const ShapingToolSchema = {
    action: z
        .enum(["start", "add_approach", "add_feedback", "add_evidence", "compare", "select"])
        .describe("Shaping action to perform"),
    planId: z.string().optional().describe("Plan identifier"),
    name: z.string().optional().describe("Approach name when action=add_approach"),
    description: z.string().optional().describe("Approach/evidence description"),
    tradeoffs: z.array(z.string()).optional().describe("Tradeoffs when action=add_approach"),
    assumptions: z.array(z.string()).optional().describe("Assumptions when action=add_approach"),
    feedback: z.string().optional().describe("Feedback when action=add_feedback"),
    evidencePath: z.string().optional().describe("Evidence path when action=add_evidence"),
    relatedTo: z.string().optional().describe("Related approach when action=add_evidence"),
    approach: z.string().optional().describe("Selected approach when action=select"),
    reason: z.string().optional().describe("Selection reason when action=select"),
} satisfies z.ZodRawShape;

async function executeShaping(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingActionSchema.parse(args);
        switch (validated.action) {
            case "start":
                return executeShapingStart(validated, context);
            case "add_approach":
                return executeShapingAddApproach(validated, context);
            case "add_feedback":
                return executeShapingAddFeedback(validated, context);
            case "add_evidence":
                return executeShapingAddEvidence(validated, context);
            case "compare":
                return executeShapingCompare(validated, context);
            case "select":
                return executeShapingSelect(validated, context);
        }
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export const shapingTool: McpTool = {
    name: "riotplan_shaping",
    description:
        "Manage shaping-stage operations with action=start|add_approach|add_feedback|add_evidence|compare|select.",
    schema: ShapingToolSchema,
    execute: executeShaping,
};
