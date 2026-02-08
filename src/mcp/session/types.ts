/**
 * Session Management Types for MCP Sampling Support
 * 
 * These types enable per-session tracking of client capabilities,
 * allowing RiotPlan to automatically detect and use MCP sampling
 * when available, or fall back to direct AI providers.
 */

/**
 * Transport type for MCP connection
 * - stdio: Local connection via standard input/output (single client per process)
 * - http: Remote connection via HTTP (multiple concurrent clients)
 */
export type Transport = 'stdio' | 'http';

/**
 * Provider mode determines how AI generation is performed
 * - sampling: Use MCP sampling (client provides AI generation)
 * - direct: Use direct API providers (Anthropic/OpenAI/Gemini)
 * - none: No AI provider available
 */
export type ProviderMode = 'sampling' | 'direct' | 'none';

/**
 * Client information from MCP initialize request
 * 
 * Matches the MCP specification for client identification.
 * See: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
 */
export interface ClientInfo {
    /** Client name (e.g., "Cursor", "GitHub Copilot", "FastMCP") */
    name: string;
    
    /** Client version (e.g., "1.0.0") */
    version: string;
    
    /** Optional display name for UI */
    title?: string;
    
    /** Optional client description */
    description?: string;
    
    /** Optional icon URLs */
    icons?: Array<{
        src: string;
        mimeType: string;
        sizes: string[];
    }>;
    
    /** Optional website URL */
    websiteUrl?: string;
}

/**
 * MCP sampling capability
 * 
 * If present, indicates the client supports MCP sampling.
 * The tools sub-capability indicates support for tool use during sampling.
 */
export interface SamplingCapability {
    /** If present, client supports tool use in sampling requests */
    tools?: Record<string, unknown>;
}

/**
 * MCP capabilities from initialize request
 * 
 * Declares which optional MCP features the client supports.
 * See: https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle#capability-negotiation
 */
export interface Capabilities {
    /** Client supports MCP sampling (delegating AI generation to client) */
    sampling?: SamplingCapability;
    
    /** Client can provide filesystem roots */
    roots?: {
        listChanged?: boolean;
    };
    
    /** Client supports elicitation (prompting user for input) */
    elicitation?: {
        form?: Record<string, unknown>;
        url?: Record<string, unknown>;
    };
    
    /** Client supports tasks */
    tasks?: {
        requests?: Record<string, unknown>;
    };
    
    /** Experimental/non-standard features */
    experimental?: Record<string, unknown>;
}

/**
 * Session context for an MCP connection
 * 
 * Tracks client information, capabilities, and provider mode for a single
 * MCP session. Sessions are created during MCP initialization and persist
 * for the lifetime of the connection.
 * 
 * For STDIO transport: One session per process
 * For HTTP transport: Multiple concurrent sessions
 */
export interface SessionContext {
    /** Unique identifier for this session */
    sessionId: string;
    
    /** Transport type (stdio or http) */
    transport: Transport;
    
    /** Client information from initialize request (null if not provided) */
    clientInfo: ClientInfo | null;
    
    /** Client capabilities from initialize request */
    capabilities: Capabilities;
    
    /** Derived: Whether client supports MCP sampling */
    samplingAvailable: boolean;
    
    /** Derived: Which provider mode to use for this session */
    providerMode: ProviderMode;
    
    /** When this session was created */
    connectedAt: Date;
    
    /** Last activity timestamp (updated on each request) */
    lastActivity: Date;
}

/**
 * Type guard to check if a value is a valid ProviderMode
 */
export function isProviderMode(value: unknown): value is ProviderMode {
    return value === 'sampling' || value === 'direct' || value === 'none';
}

/**
 * Type guard to check if a value is a valid Transport
 */
export function isTransport(value: unknown): value is Transport {
    return value === 'stdio' || value === 'http';
}

/**
 * Utility to check if sampling is available in capabilities
 */
export function hasSamplingCapability(capabilities: Capabilities): boolean {
    return capabilities.sampling !== undefined;
}

/**
 * Utility to check if tool use in sampling is supported
 */
export function hasToolsInSampling(capabilities: Capabilities): boolean {
    return capabilities.sampling?.tools !== undefined;
}
