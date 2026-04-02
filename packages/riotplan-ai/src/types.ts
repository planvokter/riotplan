/**
 * LLM Provider types for AI plan generation
 * 
 * These types define the interface between the AI module and LLM providers.
 */

export interface Message {
    role: 'user' | 'assistant' | 'system' | 'developer' | 'tool';
    content: string | string[] | null;
    name?: string;
}

export interface Request {
    messages: Message[];
    model: string;
    responseFormat?: any;
    validator?: any;
    addMessage(message: Message): void;
}

export interface ProviderResponse {
    content: string;
    model: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    toolCalls?: Array<{
        id: string;
        type: 'function';
        function: {
            name: string;
            arguments: string;
        };
    }>;
}

export interface StreamChunk {
    type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'usage' | 'done';
    text?: string;
    toolCall?: {
        id?: string;
        index?: number;
        name?: string;
        argumentsDelta?: string;
    };
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
}

export interface Provider {
    name: string;
    execute(request: Request, options?: ExecutionOptions): Promise<ProviderResponse>;
    executeStream?(request: Request, options?: ExecutionOptions): AsyncIterable<StreamChunk>;
}

export interface ExecutionOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
}
