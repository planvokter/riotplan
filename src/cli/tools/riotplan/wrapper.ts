/**
 * MCP to Agentic Tool Wrapper
 * 
 * Converts MCP tool definitions to agentic Tool format.
 */

import type { Tool, ToolParameter, ToolContext } from '@kjerneverk/agentic';
import type { McpTool, ToolExecutionContext } from '../../../mcp/types.js';

/**
 * Convert a Zod schema shape to agentic ToolParameter format
 * Uses runtime introspection to avoid Zod version conflicts
 */
function zodShapeToParameters(shape: Record<string, any>): {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
} {
    const properties: Record<string, ToolParameter> = {};
    const required: string[] = [];

    for (const [key, zodType] of Object.entries(shape)) {
        const param = zodTypeToParameter(zodType);
        if (param) {
            properties[key] = param;
            
            // Check if required using runtime check
            const typeName = zodType?.constructor?.name || '';
            if (!typeName.includes('Optional') && !typeName.includes('Nullable')) {
                // Also check _def for optional flag
                if (!zodType?._def?.typeName?.includes('Optional')) {
                    required.push(key);
                }
            }
        }
    }

    return {
        type: 'object',
        properties,
        ...(required.length > 0 ? { required } : {}),
    };
}

/**
 * Convert a single Zod type to ToolParameter using runtime introspection
 */
function zodTypeToParameter(zodType: any): ToolParameter {
    // Get description from Zod metadata
    const description = zodType?.description || zodType?._def?.description || '';
    
    // Get the inner type if wrapped in optional/nullable
    let innerType = zodType;
    const typeName = zodType?._def?.typeName || zodType?.constructor?.name || '';
    
    if (typeName.includes('Optional') || typeName.includes('Nullable')) {
        innerType = zodType?._def?.innerType || zodType?.unwrap?.() || zodType;
    }
    
    const innerTypeName = innerType?._def?.typeName || innerType?.constructor?.name || '';
    
    // Determine type based on Zod type name
    if (innerTypeName.includes('String')) {
        return { type: 'string', description };
    }
    if (innerTypeName.includes('Number')) {
        return { type: 'number', description };
    }
    if (innerTypeName.includes('Boolean')) {
        return { type: 'boolean', description };
    }
    if (innerTypeName.includes('Enum')) {
        const values = innerType?._def?.values || [];
        return { 
            type: 'string', 
            description,
            enum: Array.isArray(values) ? values : Object.values(values),
        };
    }
    if (innerTypeName.includes('Array')) {
        const elementType = innerType?._def?.type || innerType?.element;
        return { 
            type: 'array', 
            description,
            items: elementType ? zodTypeToParameter(elementType) : { type: 'string', description: '' },
        };
    }
    if (innerTypeName.includes('Object')) {
        const shape = innerType?._def?.shape?.() || innerType?.shape || {};
        const props: Record<string, ToolParameter> = {};
        const req: string[] = [];
        
        for (const [k, v] of Object.entries(shape)) {
            props[k] = zodTypeToParameter(v);
            const vTypeName = (v as any)?._def?.typeName || '';
            if (!vTypeName.includes('Optional')) {
                req.push(k);
            }
        }
        
        return {
            type: 'object',
            description,
            properties: props,
            required: req.length > 0 ? req : undefined,
        };
    }

    // Default fallback
    return { type: 'string', description };
}

/**
 * Wrap an MCP tool as an agentic Tool
 */
export function wrapMcpTool(
    mcpTool: McpTool,
    options?: {
        /** Override the tool name (e.g., add prefix) */
        name?: string;
        /** Category for the tool */
        category?: string;
    }
): Tool {
    const parameters = zodShapeToParameters(mcpTool.schema);

    return {
        name: options?.name || mcpTool.name.replace('riotplan_', 'rp_'),
        description: mcpTool.description,
        parameters,
        category: options?.category || 'riotplan',
        cost: 'cheap',
        execute: async (params: Record<string, any>, context?: ToolContext) => {
            // Build MCP execution context
            const mcpContext: ToolExecutionContext = {
                workingDirectory: context?.workingDirectory || process.cwd(),
                config: context?.storage?.config,
                logger: context?.logger,
            };

            // Execute the MCP tool
            const result = await mcpTool.execute(params, mcpContext);

            // Format result for LLM consumption
            if (result.success) {
                if (result.data?.message) {
                    return result.data.message;
                }
                if (result.data) {
                    return JSON.stringify(result.data, null, 2);
                }
                return result.message || 'Success';
            } else {
                throw new Error(result.error || 'Tool execution failed');
            }
        },
    };
}

/**
 * Wrap multiple MCP tools
 */
export function wrapMcpTools(
    mcpTools: McpTool[],
    options?: {
        category?: string;
        namePrefix?: string;
    }
): Tool[] {
    return mcpTools.map(tool => wrapMcpTool(tool, {
        category: options?.category,
        name: options?.namePrefix 
            ? `${options.namePrefix}${tool.name.replace('riotplan_', '')}`
            : undefined,
    }));
}
