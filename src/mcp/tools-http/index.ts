/**
 * HTTP MCP Tools
 *
 * Simplified tool set for HTTP MCP server that works with StorageProvider API
 */

import type { z } from 'zod';
import type { HttpToolContext, ToolResult } from './shared.js';
import { plansListSchema, executeListPlans } from './plans-list.js';
import { planStatusSchema, executePlanStatus } from './plan-status.js';
import { stepUpdateSchema, executeStepUpdate } from './step-update.js';

/**
 * HTTP MCP Tool definition
 */
export interface HttpMcpTool {
    name: string;
    description: string;
    schema: z.ZodType<any>;
    execute: (args: any, context: HttpToolContext) => Promise<ToolResult>;
}

/**
 * All HTTP MCP tools
 */
export const httpTools: HttpMcpTool[] = [
    {
        name: 'riotplan_list_plans',
        description: 'List all plans with metadata and progress',
        schema: plansListSchema,
        execute: executeListPlans,
    },
    {
        name: 'riotplan_status',
        description: 'Get plan status and progress information',
        schema: planStatusSchema,
        execute: executePlanStatus,
    },
    {
        name: 'riotplan_step_update',
        description: 'Update step status (start, complete, skip)',
        schema: stepUpdateSchema,
        execute: executeStepUpdate,
    },
];

/**
 * Get tool by name
 */
export function getHttpTool(name: string): HttpMcpTool | undefined {
    return httpTools.find((tool) => tool.name === name);
}
