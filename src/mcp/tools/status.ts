/**
 * Status Tool - Show plan status
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess, ensurePlanManifest } from './shared.js';
import { loadPlan } from '../../plan/loader.js';
import { createSqliteProvider } from '@kjerneverk/riotplan-format';

async function executeStatus(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveDirectory(args, context);

        // Handle .plan (SQLite) files
        if (planPath.endsWith('.plan')) {
            const provider = createSqliteProvider(planPath);
            const exists = await provider.exists();
            if (!exists) {
                await provider.close();
                return formatError(new Error(`Plan not found: ${planPath}`));
            }
            const metaResult = await provider.getMetadata();
            const stepsResult = await provider.getSteps();
            await provider.close();
            if (!metaResult.success || !metaResult.data) {
                return formatError(new Error('Failed to read plan metadata'));
            }
            const meta = metaResult.data;
            const steps = stepsResult.success ? stepsResult.data || [] : [];
            const completed = steps.filter(
                (s: { status: string }) => s.status === 'completed' || s.status === 'skipped'
            ).length;
            const total = steps.length;
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            const lastCompletedStep = steps
                .filter((s: { status: string }) => s.status === 'completed' || s.status === 'skipped')
                .map((s: { number: number }) => s.number)
                .sort((a: number, b: number) => b - a)[0];
            const inProgress = steps.find((s: { status: string }) => s.status === 'in_progress');
            let status: string;
            if (steps.length === 0) {
                status = meta.stage === 'completed' || meta.stage === 'cancelled' ? meta.stage : 'pending';
            } else if (inProgress) {
                status = 'in_progress';
            } else if (steps.some((s: { status: string }) => s.status === 'pending')) {
                status = 'pending';
            } else {
                status = 'completed';
            }

            const statusData: any = {
                planId: meta.id,
                code: meta.id,
                name: meta.name,
                status,
                lastCompleted: lastCompletedStep,
                progress: { completed, total, percentage },
                blockers: [],
                issues: [],
                lastUpdated: meta.updatedAt,
            };
            if (args.verbose) {
                statusData.steps = steps.map((s: any) => ({
                    number: s.number,
                    title: s.title,
                    status: s.status,
                    startedAt: s.startedAt,
                    completedAt: s.completedAt,
                }));
            }
            return createSuccess(statusData);
        }

        // Directory-based plan
        await ensurePlanManifest(planPath);
        const plan = await loadPlan(planPath);

        const completed = plan.steps.filter(s => s.status === 'completed').length;
        const total = plan.steps.length;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

        const statusData: any = {
            planId: plan.metadata.code,
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
        planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
        verbose: z.boolean().optional().describe('Include verbose output (default: false)'),
    },
    execute: executeStatus,
};
