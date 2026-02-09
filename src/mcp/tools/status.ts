/**
 * Status Tool - Show plan status
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { loadPlan } from '../../plan/loader.js';

async function executeStatus(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        
        const plan = await loadPlan(planPath);

        const completed = plan.steps.filter(s => s.status === 'completed').length;
        const total = plan.steps.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        const statusData: any = {
            planPath: plan.metadata.path,
            code: plan.metadata.code,
            name: plan.metadata.name,
            status: plan.state.status,
            currentStep: plan.state.currentStep,
            lastCompleted: plan.state.lastCompletedStep,
            progress: {
                completed,
                total,
                percentage,
            },
            blockers: plan.state.blockers || [],
            issues: plan.state.issues || [],
            startedAt: plan.state.startedAt,
            lastUpdated: plan.state.lastUpdatedAt,
        };

        if (args.verbose) {
            statusData.steps = plan.steps.map(s => ({
                number: s.number,
                title: s.title,
                status: s.status,
                startedAt: s.startedAt,
                completedAt: s.completedAt,
            }));
        }

        return createSuccess(statusData);
    } catch (error) {
        return formatError(error);
    }
}

export const statusTool: McpTool = {
    name: 'riotplan_status',
    description:
        'Show current plan status including progress, current step, blockers, and issues. ' +
        'Returns structured status information.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        verbose: z.boolean().optional().describe('Include verbose output (default: false)'),
    },
    execute: executeStatus,
};
