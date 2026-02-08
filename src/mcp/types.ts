/**
 * MCP Type Definitions for RiotPlan
 *
 * This module defines types for the Model Context Protocol integration,
 * including protocol types, RiotPlan-specific types, and resource result types.
 */

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP Tool definition
 * Represents a callable tool exposed via MCP
 */
export interface McpTool {
    name: string;
    description: string;
    inputSchema: {
        type: 'object';
        properties: Record<string, McpToolParameter>;
        required?: string[];
    };
}

/**
 * MCP Tool Parameter definition
 * Describes a single parameter for a tool
 */
export interface McpToolParameter {
    type: string;
    description: string;
    enum?: string[];
    items?: { type: string };
}

/**
 * MCP Resource definition
 * Represents a readable resource exposed via MCP
 */
export interface McpResource {
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
}

/**
 * MCP Prompt definition
 * Represents a workflow prompt template
 */
export interface McpPrompt {
    name: string;
    description: string;
    arguments?: Array<{
        name: string;
        description: string;
        required: boolean;
    }>;
}

/**
 * MCP Prompt Message
 * Represents a message in a prompt template
 */
export interface McpPromptMessage {
    role: 'user' | 'assistant';
    content: {
        type: 'text' | 'image' | 'resource';
        text?: string;
        data?: string;
        mimeType?: string;
    };
}

// ============================================================================
// RiotPlan-Specific Types
// ============================================================================

/**
 * Parsed riotplan:// URI
 * Represents the structured components of a riotplan URI
 */
export interface RiotplanUri {
    scheme: 'riotplan';
    type: 
        // Plan execution resources
        | 'plan' 
        | 'status' 
        | 'steps' 
        | 'step' 
        | 'feedback' 
        | 'analysis'
        // Ideation context resources
        | 'idea'
        | 'timeline'
        | 'prompts'
        | 'prompt'
        | 'evidence'
        | 'evidence-file'
        | 'shaping'
        | 'checkpoints'
        | 'checkpoint';
    path?: string;
    query?: Record<string, string>;
}

/**
 * Progress notification callback
 * Called periodically during long-running operations to send progress updates
 * Can be async to support sending notifications
 */
export interface ProgressCallback {
    (progress: number, total: number | null, message: string, logs?: string[]): void | Promise<void>;
}

/**
 * Tool Execution Context
 * Provides context for tool execution
 */
export interface ToolExecutionContext {
    workingDirectory: string;
    config?: any;
    logger?: any;
    session?: any; // SessionContext from session module
    progressCallback?: ProgressCallback;
    sendNotification?: (notification: {
        method: string;
        params: {
            progressToken?: string | number;
            progress: number;
            total?: number;
            message?: string;
        };
    }) => Promise<void>;
    progressToken?: string | number;
}

/**
 * Tool Result
 * Standard result format for tool execution
 */
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
    context?: Record<string, any>;
    recovery?: string[];
    details?: {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        files?: string[];
        phase?: string;
    };
    progress?: {
        current: number;
        total: number;
        currentStep: string;
        completedSteps: string[];
    };
    logs?: string[];
}

// ============================================================================
// Resource Result Types
// ============================================================================

/**
 * Plan Resource
 * Result of reading a plan
 */
export interface PlanResource {
    path: string;
    code: string;
    name: string;
    exists: boolean;
    metadata?: any;
    state?: any;
}

/**
 * Status Resource
 * Result of reading plan status
 */
export interface StatusResource {
    planPath: string;
    status: string;
    currentStep?: number;
    lastCompleted?: number;
    progress: {
        completed: number;
        total: number;
        percentage: number;
    };
    blockers: string[];
    issues: string[];
}

/**
 * Steps Resource
 * Result of reading plan steps
 */
export interface StepsResource {
    planPath: string;
    steps: Array<{
        number: number;
        title: string;
        status: string;
        file: string;
    }>;
}

/**
 * Step Resource
 * Result of reading a single step
 */
export interface StepResource {
    planPath: string;
    number: number;
    title: string;
    status: string;
    file: string;
    content: string;
}

/**
 * Feedback Resource
 * Result of reading feedback records
 */
export interface FeedbackResource {
    planPath: string;
    feedbackRecords: Array<{
        id: string;
        date: string;
        content: string;
    }>;
}

/**
 * Analysis Resource
 * Result of reading analysis
 */
export interface AnalysisResource {
    planPath: string;
    analysisFiles: Array<{
        name: string;
        path: string;
        content: string;
    }>;
}
