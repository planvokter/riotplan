/**
 * Heartbeat context builder for RiotPlan MCP tools
 * 
 * Generates contextual reminders that are appended to every tool response,
 * keeping the model focused on plan development and aware of current state.
 */

import { readFile, access } from 'node:fs/promises';
import { join, basename } from 'node:path';

/**
 * Stage-specific guidance for next actions
 */
const STAGE_GUIDANCE: Record<string, string> = {
    idea: 'Continue exploring, add notes/constraints/questions, or move to shaping',
    shaping: 'Add approaches, compare tradeoffs, or select an approach',
    built: 'Review steps, validate plan, or begin execution',
    executing: 'Complete current step, mark progress, or report blockers',
    done: 'Plan complete',
};

/**
 * Extract stage from LIFECYCLE.md content
 */
function extractStage(content: string): string | null {
    const stageMatch = content.match(/\*\*Stage\*\*: `(\w+)`/);
    return stageMatch ? stageMatch[1] : null;
}

/**
 * Extract plan code/name from IDEA.md content
 */
function extractPlanCode(content: string): string | null {
    const codeMatch = content.match(/# Idea: (.+)/);
    return codeMatch ? codeMatch[1] : null;
}

/**
 * Extract last action from timeline.jsonl
 */
async function getLastAction(planDirectory: string): Promise<string | null> {
    try {
        const timelinePath = join(planDirectory, '.history', 'timeline.jsonl');
        await access(timelinePath);
        
        const content = await readFile(timelinePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
            return null;
        }
        
        // Get the last line
        const lastLine = lines[lines.length - 1];
        const entry = JSON.parse(lastLine);
        
        // Format based on event type
        if (entry.type === 'note_added') {
            return 'Added note';
        } else if (entry.type === 'narrative_chunk') {
            return 'Added narrative';
        } else if (entry.type === 'question_added') {
            return 'Added question';
        } else if (entry.type === 'constraint_added') {
            return 'Added constraint';
        } else if (entry.type === 'evidence_added') {
            return 'Added evidence';
        } else if (entry.type === 'approach_added') {
            return 'Added approach';
        } else if (entry.type === 'approach_selected') {
            return 'Selected approach';
        } else if (entry.type === 'step_started') {
            return `Started step ${entry.data?.step || ''}`;
        } else if (entry.type === 'step_completed') {
            return `Completed step ${entry.data?.step || ''}`;
        } else if (entry.type === 'idea_created') {
            return 'Created idea';
        } else if (entry.type === 'shaping_started') {
            return 'Started shaping';
        }
        
        return entry.type.replace(/_/g, ' ');
    } catch {
        return null;
    }
}

/**
 * Read plan state from filesystem
 */
async function readPlanState(planDirectory: string): Promise<{
    stage: string | null;
    planCode: string | null;
    lastAction: string | null;
}> {
    let stage: string | null = null;
    let planCode: string | null = null;
    let lastAction: string | null = null;
    
    // Try to read LIFECYCLE.md for stage
    try {
        const lifecyclePath = join(planDirectory, 'LIFECYCLE.md');
        await access(lifecyclePath);
        const content = await readFile(lifecyclePath, 'utf-8');
        stage = extractStage(content);
    } catch {
        // File doesn't exist or can't be read
    }
    
    // Try to read IDEA.md for plan code
    try {
        const ideaPath = join(planDirectory, 'IDEA.md');
        await access(ideaPath);
        const content = await readFile(ideaPath, 'utf-8');
        planCode = extractPlanCode(content);
    } catch {
        // File doesn't exist, fall back to directory name
        planCode = basename(planDirectory);
    }
    
    // Try to get last action from timeline
    lastAction = await getLastAction(planDirectory);
    
    return { stage, planCode, lastAction };
}

/**
 * Generate heartbeat footer for tool responses
 * 
 * @param planDirectory - Absolute path to the plan directory
 * @returns Formatted heartbeat string or null if not in a plan context
 */
export async function generateHeartbeat(planDirectory: string): Promise<string | null> {
    try {
        // Check if this looks like a plan directory
        const hasLifecycle = await access(join(planDirectory, 'LIFECYCLE.md'))
            .then(() => true)
            .catch(() => false);
        const hasIdea = await access(join(planDirectory, 'IDEA.md'))
            .then(() => true)
            .catch(() => false);
        const hasStatus = await access(join(planDirectory, 'STATUS.md'))
            .then(() => true)
            .catch(() => false);
        
        // If none of the plan files exist, return null (not a plan directory)
        if (!hasLifecycle && !hasIdea && !hasStatus) {
            return null;
        }
        
        // Read plan state
        const { stage, planCode, lastAction } = await readPlanState(planDirectory);
        
        // Build heartbeat lines
        const lines: string[] = [];
        lines.push('---');
        
        // Line 1: Status header
        const statusParts: string[] = ['📋 RiotPlan Active'];
        if (planCode) {
            statusParts.push(`Plan: ${planCode}`);
        }
        if (stage) {
            statusParts.push(`Stage: ${stage}`);
        }
        statusParts.push(`Dir: ${planDirectory}`);
        lines.push(statusParts.join(' | '));
        
        // Line 2: Last action and next suggestion
        const actionParts: string[] = [];
        if (lastAction) {
            actionParts.push(`Last: ${lastAction}`);
        }
        const nextGuidance = stage ? STAGE_GUIDANCE[stage] : STAGE_GUIDANCE.idea;
        if (nextGuidance) {
            actionParts.push(`Next: ${nextGuidance}`);
        }
        if (actionParts.length > 0) {
            lines.push(actionParts.join(' | '));
        }
        
        // Line 3: Reminder
        lines.push('⚠️ Stay in plan mode. Capture insights with RiotPlan tools. Do not implement.');
        
        lines.push('---');
        
        return '\n\n' + lines.join('\n');
    } catch {
        // If anything fails, return a generic reminder
        return '\n\n---\n📋 RiotPlan Active\n⚠️ Stay in plan mode. Capture insights with RiotPlan tools. Do not implement.\n---';
    }
}
