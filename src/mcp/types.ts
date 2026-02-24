/**
 * MCP Type Definitions for RiotPlan
 *
 * This module defines types for the Model Context Protocol integration,
 * including protocol types, RiotPlan-specific types, and resource result types.
 */

import { z } from 'zod';

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * MCP Tool definition
 * Represents a callable tool exposed via MCP
 * Each tool is a self-contained descriptor with Zod schema and executor
 */
export interface McpTool {
    name: string;
    description: string;
    schema: z.ZodRawShape;
    execute: (args: Record<string, any>, context: ToolExecutionContext) => Promise<ToolResult>;
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
        | 'artifact'
        | 'execution-plan'
        | 'summary'
        | 'provenance'
        | 'timeline'
        | 'history'
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
    /** Optional context root used by context entity tools */
    contextDir?: string;
    config?: any;
    logger?: any;
    session?: any; // SessionContext from session module
    mcpServer?: any; // MCP server instance for sampling requests
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
    /** Callback to update the shared context (e.g., change working directory) */
    updateContext?: (updates: { workingDirectory?: string; [key: string]: any }) => void;
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

export interface BuildInstructionPayload {
    planId: string;
    planName: string;
    currentStage: string;
    generationInstructions: {
        systemPrompt: string;
        userPrompt: string;
        responseSchema: unknown;
        expectedStepCount: number;
    };
    generationContext: unknown;
    contextCoverage: {
        planStage: string;
        includedArtifacts: Array<{
            id: string;
            present: boolean;
            includedInPrompt: boolean;
            sizeBytes?: number;
            itemCount?: number;
        }>;
        coverageCounts: {
            constraints: number;
            questions: number;
            evidence: number;
            historyEvents: number;
            catalysts: number;
        };
    };
    missingContext: Array<{
        artifact: string;
        severity: "required" | "recommended";
        reason: string;
    }>;
    inclusionProof: {
        planId: string;
        generatedAt: string;
        promptSha256: string;
        artifactSha256: Record<string, string>;
    };
    writeProtocol: {
        mode: "directory" | "sqlite";
        requiredArtifacts: Array<"summary" | "execution_plan" | "status" | "provenance" | "steps">;
        requiredTools: {
            validate: string;
            artifact: string;
            step: string;
            transition: string;
        };
        sequence: string[];
        constraints: string[];
    };
    validationProtocol: {
        requiredTopLevelFields: string[];
        requiredStepFields: string[];
        filesChangedRule: string;
        filesChangedExamples: string[];
        requiredGrounding: string[];
        preWriteGate: {
            required: boolean;
            tool: string;
            stampField: string;
            reason: string;
        };
    };
}

// ============================================================================
// Resource Result Types
// ============================================================================

/**
 * Plan Resource
 * Result of reading a plan
 */
export interface PlanResource {
    planId: string | null;
    code: string;
    name: string;
    exists: boolean;
    metadata?: {
        code: string;
        name: string;
        description?: string;
        created?: Date;
        projectPath?: string;
    };
    state?: {
        status: string;
        currentStep?: number;
        lastCompleted?: number;
        startedAt?: Date;
        lastUpdated?: Date;
    };
}

/**
 * Status Resource
 * Result of reading plan status
 */
export interface StatusResource {
    planId: string;
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
    planId: string;
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
    planId: string;
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
    planId: string;
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
    planId: string;
    analysisFiles: Array<{
        name: string;
        path: string;
        content: string;
    }>;
}
