/**
 * MCP tools for Shaping stage management
 */

import { z } from "zod";
import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { formatTimestamp, resolveDirectory } from "./shared.js";
import { logEvent } from "./history.js";

// Tool schemas
export const ShapingStartSchema = z.object({
    path: z.string().optional().describe("Path to idea directory"),
});

export const ShapingAddApproachSchema = z.object({
    path: z.string().optional().describe("Path to shaping directory"),
    name: z.string().describe("Name of the approach"),
    description: z.string().describe("Description of the approach"),
    tradeoffs: z.array(z.string()).optional().describe("List of tradeoffs (pros/cons)"),
    assumptions: z.array(z.string()).optional().describe("Key assumptions"),
});

export const ShapingAddFeedbackSchema = z.object({
    path: z.string().optional().describe("Path to shaping directory"),
    feedback: z.string().describe("Feedback about the current shaping"),
});

export const ShapingAddEvidenceSchema = z.object({
    path: z.string().optional().describe("Path to shaping directory"),
    evidencePath: z.string().describe("Path to evidence file"),
    description: z.string().optional().describe("Description of the evidence"),
    relatedTo: z.string().optional().describe("Which approach this evidence relates to"),
});

export const ShapingCompareSchema = z.object({
    path: z.string().optional().describe("Path to shaping directory"),
});

export const ShapingSelectSchema = z.object({
    path: z.string().optional().describe("Path to shaping directory"),
    approach: z.string().describe("Name of the selected approach"),
    reason: z.string().describe("Reason for selecting this approach"),
});

// Tool implementations

export async function shapingStart(args: z.infer<typeof ShapingStartSchema>): Promise<string> {
    const shapingPath = args.path || process.cwd();
  
    // Create SHAPING.md
    const shapingContent = `# Shaping: [Name]

## Problem Statement

_What problem are we solving? What are we trying to achieve?_

## Approaches Considered

_Add approaches using riotplan_shaping_add_approach_

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

    await writeFile(join(shapingPath, "SHAPING.md"), shapingContent, "utf-8");
  
    // Update LIFECYCLE.md
    const lifecycleFile = join(shapingPath, "LIFECYCLE.md");
    let lifecycle = await readFile(lifecycleFile, "utf-8");
  
    // Update current stage
    lifecycle = lifecycle.replace(
        /\*\*Stage\*\*: `\w+`/,
        `**Stage**: \`shaping\``
    );
    lifecycle = lifecycle.replace(
        /\*\*Since\*\*: .+/,
        `**Since**: ${formatTimestamp()}`
    );
  
    // Add to state history
    const historyTable = lifecycle.indexOf("| From | To | When | Reason |");
    if (historyTable !== -1) {
        const nextLine = lifecycle.indexOf("\n", historyTable + 50);
        const newRow = `| idea | shaping | ${formatTimestamp()} | Ready to explore approaches |\n`;
        lifecycle = lifecycle.slice(0, nextLine + 1) + newRow + lifecycle.slice(nextLine + 1);
    }
  
    await writeFile(lifecycleFile, lifecycle, "utf-8");
  
    // Log event
    await logEvent(shapingPath, {
        timestamp: formatTimestamp(),
        type: 'shaping_started',
        data: {},
    });
  
    return `✅ Shaping started\n\nNext steps:\n- Add approaches: riotplan_shaping_add_approach\n- Provide feedback: riotplan_shaping_add_feedback\n- Add evidence: riotplan_shaping_add_evidence\n- Compare approaches: riotplan_shaping_compare\n- When ready: riotplan_shaping_select`;
}

export async function shapingAddApproach(args: z.infer<typeof ShapingAddApproachSchema>): Promise<string> {
    const shapingPath = args.path || process.cwd();
    const shapingFile = join(shapingPath, "SHAPING.md");
  
    let content = await readFile(shapingFile, "utf-8");
  
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
  
    await writeFile(shapingFile, content, "utf-8");
  
    // Log event
    await logEvent(shapingPath, {
        timestamp: formatTimestamp(),
        type: 'approach_added',
        data: {
            name: args.name,
            description: args.description,
            tradeoffs: args.tradeoffs,
            assumptions: args.assumptions,
        },
    });
  
    return `✅ Approach added: ${args.name}`;
}

export async function shapingAddFeedback(args: z.infer<typeof ShapingAddFeedbackSchema>): Promise<string> {
    const shapingPath = args.path || process.cwd();
    const shapingFile = join(shapingPath, "SHAPING.md");
  
    let content = await readFile(shapingFile, "utf-8");
  
    const feedbackSection = "## Feedback";
    const feedbackIndex = content.indexOf(feedbackSection);
  
    if (feedbackIndex === -1) {
        throw new Error("Could not find Feedback section in SHAPING.md");
    }
  
    const nextSectionIndex = content.indexOf("\n## ", feedbackIndex + feedbackSection.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
  
    const feedback = `\n### ${formatTimestamp()}\n\n${args.feedback}\n`;
    content = content.slice(0, insertPoint) + feedback + content.slice(insertPoint);
  
    await writeFile(shapingFile, content, "utf-8");
  
    // Log event
    await logEvent(shapingPath, {
        timestamp: formatTimestamp(),
        type: 'feedback_added',
        data: { feedback: args.feedback },
    });
  
    return `✅ Feedback added`;
}

export async function shapingAddEvidence(args: z.infer<typeof ShapingAddEvidenceSchema>): Promise<string> {
    const shapingPath = args.path || process.cwd();
    const shapingFile = join(shapingPath, "SHAPING.md");
  
    let content = await readFile(shapingFile, "utf-8");
  
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
  
    await writeFile(shapingFile, content, "utf-8");
  
    // Log event
    await logEvent(shapingPath, {
        timestamp: formatTimestamp(),
        type: 'evidence_added',
        data: {
            evidencePath: args.evidencePath,
            description: args.description,
            relatedTo: args.relatedTo,
        },
    });
  
    return `✅ Evidence added`;
}

export async function shapingCompare(args: z.infer<typeof ShapingCompareSchema>): Promise<string> {
    const shapingPath = args.path || process.cwd();
    const shapingFile = join(shapingPath, "SHAPING.md");
  
    const content = await readFile(shapingFile, "utf-8");
  
    // Extract approaches
    const approachesSection = content.indexOf("## Approaches Considered");
    const nextSection = content.indexOf("\n## ", approachesSection + 25);
    const approachesContent = content.slice(approachesSection, nextSection !== -1 ? nextSection : undefined);
  
    // Parse approaches (simple extraction)
    const approaches = approachesContent.match(/### Approach: (.+)/g) || [];
  
    if (approaches.length === 0) {
        return "No approaches found. Add approaches first using riotplan_shaping_add_approach";
    }
  
    let comparison = "## Approach Comparison\n\n";
    approaches.forEach(approach => {
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
    await logEvent(shapingPath, {
        timestamp: formatTimestamp(),
        type: 'approach_compared',
        data: { approachCount: approaches.length },
    });
  
    return comparison;
}

export async function shapingSelect(args: z.infer<typeof ShapingSelectSchema>): Promise<string> {
    const shapingPath = args.path || process.cwd();
    const shapingFile = join(shapingPath, "SHAPING.md");
  
    let content = await readFile(shapingFile, "utf-8");
  
    // Add selection to Key Decisions
    const decisionsSection = "## Key Decisions";
    const decisionsIndex = content.indexOf(decisionsSection);
  
    if (decisionsIndex !== -1) {
        const nextSectionIndex = content.indexOf("\n## ", decisionsIndex + decisionsSection.length);
        const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    
        const decision = `\n**Selected Approach**: ${args.approach}\n\n**Reasoning**: ${args.reason}\n\n**Selected At**: ${formatTimestamp()}\n`;
        content = content.slice(0, insertPoint) + decision + content.slice(insertPoint);
    
        await writeFile(shapingFile, content, "utf-8");
    }
  
    // Log event
    await logEvent(shapingPath, {
        timestamp: formatTimestamp(),
        type: 'approach_selected',
        data: {
            approach: args.approach,
            reason: args.reason,
        },
    });
  
    return `✅ Approach selected: ${args.approach}\n\nNext: Transition to 'built' stage to generate detailed plan:\n  riotplan_transition({ stage: "built", reason: "Approach selected: ${args.approach}" })`;
}

// Tool executors for MCP
import type { ToolResult, ToolExecutionContext } from '../types.js';

export async function executeShapingStart(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingStartSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await shapingStart({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingAddApproach(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingAddApproachSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await shapingAddApproach({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingAddFeedback(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingAddFeedbackSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await shapingAddFeedback({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingAddEvidence(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingAddEvidenceSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await shapingAddEvidence({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingCompare(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingCompareSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await shapingCompare({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function executeShapingSelect(args: any, context: ToolExecutionContext): Promise<ToolResult> {
    try {
        const validated = ShapingSelectSchema.parse(args);
        // Use directory resolution logic when no explicit path is provided
        const resolvedPath = validated.path || resolveDirectory(args, context);
        const result = await shapingSelect({ ...validated, path: resolvedPath });
        return { success: true, data: { message: result } };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Tool definitions for MCP
import type { McpTool } from '../types.js';

export const shapingStartTool: McpTool = {
    name: "riotplan_shaping_start",
    description: "Start shaping an idea. Transitions from idea to shaping stage.",
    inputSchema: ShapingStartSchema.shape as any,
};

export const shapingAddApproachTool: McpTool = {
    name: "riotplan_shaping_add_approach",
    description: "Add an approach to consider during shaping. Include tradeoffs and assumptions.",
    inputSchema: ShapingAddApproachSchema.shape as any,
};

export const shapingAddFeedbackTool: McpTool = {
    name: "riotplan_shaping_add_feedback",
    description: "Add feedback about the current shaping. Use this to capture thoughts, concerns, or refinements.",
    inputSchema: ShapingAddFeedbackSchema.shape as any,
};

export const shapingAddEvidenceTool: McpTool = {
    name: "riotplan_shaping_add_evidence",
    description: "Add evidence (documents, images, diagrams) to support decision-making during shaping.",
    inputSchema: ShapingAddEvidenceSchema.shape as any,
};

export const shapingCompareTool: McpTool = {
    name: "riotplan_shaping_compare",
    description: "Compare all approaches side-by-side to help make a decision.",
    inputSchema: ShapingCompareSchema.shape as any,
};

export const shapingSelectTool: McpTool = {
    name: "riotplan_shaping_select",
    description: "Select an approach and prepare to transition to 'built' stage.",
    inputSchema: ShapingSelectSchema.shape as any,
};
