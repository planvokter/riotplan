/**
 * Validate Tool - Validate plan structure
 */

import { z } from 'zod';
import type { McpTool, ToolResult, ToolExecutionContext } from '../types.js';
import { resolveDirectory, formatError, createSuccess } from './shared.js';
import { validatePlan } from '../../plan/validator.js';

async function executeValidate(
    args: any,
    context: ToolExecutionContext
): Promise<ToolResult> {
    try {
        const planPath = args.path ? args.path : resolveDirectory(args, context);
        
        const result = await validatePlan(planPath);

        return createSuccess(
            {
                planPath,
                valid: result.valid,
                errors: result.errors || [],
                warnings: result.warnings || [],
                fixable: result.fixable || [],
            },
            result.valid
                ? 'Plan validation passed'
                : `Plan validation failed with ${result.errors.length} error(s)`
        );
    } catch (error) {
        return formatError(error);
    }
}

export const validateTool: McpTool = {
    name: 'riotplan_validate',
    description:
        'Validate plan structure and files. ' +
        'Checks for required files, valid STATUS.md, step numbering, and dependencies. ' +
        'Can optionally attempt to fix issues.',
    schema: {
        path: z.string().optional().describe('Plan directory path (defaults to current directory)'),
        fix: z.boolean().optional().describe('Attempt to fix issues (default: false)'),
    },
    execute: executeValidate,
};
