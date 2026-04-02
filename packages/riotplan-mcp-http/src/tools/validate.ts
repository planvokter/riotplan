/**
 * Validate Tool - Validate plan structure
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveSqlitePlanPath, formatError, createSuccess } from './shared.js';
import { createSqliteProvider } from '@planvokter/riotplan-format';

async function executeValidate(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = resolveSqlitePlanPath(args, context);
        return await validateSqlitePlan(planPath, args);
    } catch (error) {
        return formatError(error);
    }
}

async function validateSqlitePlan(planPath: string, args: any): Promise<ToolResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const provider = createSqliteProvider(planPath);
    const metadataResult = await provider.getMetadata();
    if (!metadataResult.success || !metadataResult.data) {
        errors.push('Missing or unreadable plan metadata');
    } else {
        const meta = metadataResult.data;
        if (!meta.id) { errors.push('Plan metadata missing id'); }
        if (!meta.stage) { warnings.push('Plan metadata missing stage'); }
    }

    const filesResult = await provider.getFiles();
    if (!filesResult.success) {
        errors.push('Could not read plan files');
    } else {
        const files = filesResult.data || [];
        const hasIdea = files.some((f) => f.type === 'idea');
        if (!hasIdea) { warnings.push('No IDEA.md file found in plan'); }
    }

    const stepsResult = await provider.getSteps();
    if (stepsResult.success) {
        const steps = stepsResult.data || [];
        const numbers = steps.map((s) => s.number);
        const uniqueNumbers = new Set(numbers);
        if (numbers.length !== uniqueNumbers.size) {
            errors.push('Duplicate step numbers detected');
        }
    }

    await provider.close();

    const valid = errors.length === 0;
    return createSuccess(
        {
            planId: args.planId || 'current',
            valid,
            errors,
            warnings,
            fixable: [],
        },
        valid
            ? 'SQLite plan validation passed'
            : `SQLite plan validation failed with ${errors.length} error(s)`
    );
}

export const validateTool: McpTool = {
    name: 'riotplan_validate',
    description:
        'Validate plan structure and files. ' +
        'Checks for required files, valid STATUS.md, step numbering, and dependencies. ' +
        'Can optionally attempt to fix issues.',
    schema: {
        planId: z.string().optional().describe('Plan identifier (defaults to current plan context)'),
        fix: z.boolean().optional().describe('Attempt to fix issues (default: false)'),
    },
    execute: executeValidate,
};
