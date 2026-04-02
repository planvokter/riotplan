declare module '@kjerneverk/agentic' {
    export type Tool = any;

    export type AgentProvider = {
        name: string;
        execute: (request: any) => Promise<any>;
        executeStream?: (request: any) => AsyncIterable<any>;
    };

    export const AgentLoop: { create: (args: any) => any };
    export const ToolRegistry: { create: (args: any) => any };
    export const ConversationManager: { create: (args?: any) => any };
}

declare module '@kjerneverk/execution' {
    export function createRequest(model: string): any;
}

declare module '@kjerneverk/execution-sampling' {
    export function createSamplingProvider(options: any): any;
}

declare module '@kjerneverk/execution-anthropic' {
    export function createAnthropicProvider(): any;
}

declare module '@kjerneverk/execution-openai' {
    export function createOpenAIProvider(): any;
}

declare module '@kjerneverk/execution-gemini' {
    export function createGeminiProvider(): any;
}
