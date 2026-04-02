/**
 * Generate Rule Tool - Generate Cursor rule file for RiotPlan integration
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { formatError, createSuccess } from './shared.js';
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';

/**
 * Cursor rule content for RiotPlan integration
 */
const CURSOR_RULE_CONTENT = `---
description: RiotPlan planning system integration - defer to RiotPlan for all planning activity
globs: ["**/plans/**", "**/IDEA.md", "**/SHAPING.md", "**/STATUS.md"]
---

# RiotPlan Owns Planning in This Project

## Rule: Defer to RiotPlan for All Planning Activity

When working in plan directories or with RiotPlan MCP tools, **RiotPlan owns the planning process**. Do not compete with it.

### Required Behaviors

1. **Do not create Cursor plans**: When you detect planning activity, do NOT offer to create a Cursor-native plan (the checkbox-style plan). RiotPlan is already managing the plan.

2. **Stay in plan development mode**: When using RiotPlan tools, you are exploring or shaping a plan—not implementing it. Do not write code or make file changes unless the user explicitly says to execute.

3. **Capture insights in the plan**: Every significant thought, decision, or finding should be captured using RiotPlan tools (\`riotplan_idea\` with actions like \`add_note\` and \`add_narrative\`). Do not just discuss—document.

4. **Ask before transitioning stages**: Do not move from idea → shaping → execution without explicit user consent. Ask: "Are you ready to move to [next stage]?" and wait for confirmation.

### When This Rule Applies

- When you see RiotPlan MCP tools being used
- When working in directories containing \`IDEA.md\`, \`SHAPING.md\`, \`STATUS.md\`, or \`LIFECYCLE.md\`
- When the user mentions working on "a plan" or "an idea" in the context of RiotPlan

### What You Should Do

✅ Use RiotPlan tools to capture notes, constraints, questions, and narratives
✅ Ask clarifying questions to explore the idea
✅ Propose approaches and tradeoffs during shaping
✅ Wait for user to explicitly request implementation
✅ Mark steps complete using \`riotplan_step\` with \`action: "complete"\` during execution

### What You Should NOT Do

❌ Offer to create a Cursor plan when RiotPlan is active
❌ Start implementing code during idea or shaping stages
❌ Have extended conversations without capturing insights in the plan
❌ Transition between stages (idea → shaping → built → executing) without asking
❌ Ignore RiotPlan tools in favor of direct file editing

### Example Scenarios

❌ **WRONG**: User is exploring an idea → You start writing implementation code

✅ **CORRECT**: User is exploring an idea → You ask questions, add notes, capture constraints

❌ **WRONG**: User discusses a solution → You implement it immediately

✅ **CORRECT**: User discusses a solution → You add it as a note and ask "Should we move to shaping to compare approaches?"

❌ **WRONG**: Cursor detects planning activity → You offer "Want me to create a plan for this?"

✅ **CORRECT**: Cursor detects planning activity → You check if a RiotPlan already exists and use RiotPlan tools

### Rationale

RiotPlan provides structured ideation, shaping, and execution tracking. When it's active, all planning activity should flow through RiotPlan to maintain a coherent record of the thought process. Competing planning systems create confusion and lose context.
`;

async function executeGenerateRule(
    args: Record<string, any>,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        // Resolve project path
        const projectPath = args.projectPath || context.workingDirectory || process.cwd();
        const force = args.force === true;
        
        // Target file path
        const ruleFilePath = join(projectPath, '.cursor', 'rules', 'riotplan.md');
        const ruleDir = dirname(ruleFilePath);
        
        // Check if file already exists
        const fileExists = await access(ruleFilePath)
            .then(() => true)
            .catch(() => false);
        
        if (fileExists && !force) {
            return {
                success: false,
                error: 'Cursor rule file already exists at .cursor/rules/riotplan.md',
                context: {
                    path: ruleFilePath,
                    suggestion: 'Use force: true to overwrite',
                },
            };
        }
        
        // Create parent directories
        await mkdir(ruleDir, { recursive: true });
        
        // Write rule file
        await writeFile(ruleFilePath, CURSOR_RULE_CONTENT, 'utf-8');
        
        return createSuccess(
            {
                path: ruleFilePath,
                projectPath,
                overwritten: fileExists,
            },
            `✅ Cursor rule created at ${ruleFilePath}\n\n` +
            `The rule configures Cursor to:\n` +
            `- Defer to RiotPlan for all planning activity\n` +
            `- Stay in plan development mode (no implementing during exploration)\n` +
            `- Capture insights using RiotPlan tools\n` +
            `- Ask before transitioning between stages\n\n` +
            `The rule activates in plan directories and when plan files are open.`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const generateRuleTool: McpTool = {
    name: 'riotplan_generate_rule',
    description:
        'Generate a Cursor rule file that configures the IDE to defer to RiotPlan for planning. ' +
        'Creates .cursor/rules/riotplan.md in the target project.',
    schema: {
        projectPath: z.string().optional().describe('Project directory path (defaults to current working directory)'),
        force: z.boolean().optional().describe('Overwrite existing rule file if present (default: false)'),
    },
    execute: executeGenerateRule,
};
