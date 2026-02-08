/**
 * SessionManager - Manages MCP session lifecycle and capability tracking
 * 
 * Handles creation, lookup, activity tracking, and cleanup of MCP sessions.
 * Each session tracks client capabilities and determines the appropriate
 * provider mode (sampling, direct, or none).
 */

import { randomUUID } from 'node:crypto';
import type {
    SessionContext,
    Transport,
    ProviderMode,
    Capabilities,
} from './types.js';
import { hasSamplingCapability } from './types.js';

/**
 * MCP Initialize Request structure
 * Matches the MCP specification initialize request format
 */
export interface InitializeRequest {
    params: {
        protocolVersion: string;
        capabilities?: Capabilities;
        clientInfo?: {
            name: string;
            version: string;
            title?: string;
            description?: string;
            icons?: Array<{
                src: string;
                mimeType: string;
                sizes: string[];
            }>;
            websiteUrl?: string;
        };
    };
}

/**
 * SessionManager configuration options
 */
export interface SessionManagerOptions {
    /** Maximum age for inactive sessions in milliseconds (default: 1 hour) */
    maxInactiveAge?: number;
    
    /** Enable debug logging */
    debug?: boolean;
}

/**
 * Manages MCP sessions and tracks client capabilities
 */
export class SessionManager {
    private sessions: Map<string, SessionContext> = new Map();
    private options: Required<SessionManagerOptions>;
    
    constructor(options: SessionManagerOptions = {}) {
        this.options = {
            maxInactiveAge: options.maxInactiveAge ?? 3600000, // 1 hour default
            debug: options.debug ?? false,
        };
    }
    
    /**
     * Create a new session from MCP initialize request
     * 
     * @param sessionId - Unique session identifier
     * @param transport - Transport type (stdio or http)
     * @param initRequest - MCP initialize request
     * @returns Created session context
     */
    createSession(
        sessionId: string,
        transport: Transport,
        initRequest: InitializeRequest
    ): SessionContext {
        const capabilities = initRequest.params.capabilities ?? {};
        const clientInfo = initRequest.params.clientInfo ?? null;
        
        const context: SessionContext = {
            sessionId,
            transport,
            clientInfo,
            capabilities,
            samplingAvailable: hasSamplingCapability(capabilities),
            providerMode: 'none', // Will be determined below
            connectedAt: new Date(),
            lastActivity: new Date(),
        };
        
        // Determine provider mode based on capabilities and environment
        context.providerMode = this.determineProviderMode(context);
        
        // Store session
        this.sessions.set(sessionId, context);
        
        // Log session creation
        this.log(
            `Session created: ${sessionId}`,
            `Client: ${clientInfo?.name ?? 'unknown'} v${clientInfo?.version ?? 'unknown'}`,
            `Transport: ${transport}`,
            `Sampling: ${context.samplingAvailable ? 'available' : 'not available'}`,
            `Provider mode: ${context.providerMode}`
        );
        
        return context;
    }
    
    /**
     * Get an existing session by ID
     * 
     * @param sessionId - Session identifier
     * @returns Session context or undefined if not found
     */
    getSession(sessionId: string): SessionContext | undefined {
        return this.sessions.get(sessionId);
    }
    
    /**
     * Update last activity timestamp for a session
     * 
     * @param sessionId - Session identifier
     */
    updateActivity(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = new Date();
        }
    }
    
    /**
     * Remove a session
     * 
     * @param sessionId - Session identifier
     */
    removeSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            this.sessions.delete(sessionId);
            this.log(
                `Session removed: ${sessionId}`,
                `Client: ${session.clientInfo?.name ?? 'unknown'}`
            );
        }
    }
    
    /**
     * Clean up inactive sessions (for HTTP mode)
     * 
     * Removes sessions that haven't had activity within maxInactiveAge.
     * 
     * @param maxAge - Optional override for max age in milliseconds
     * @returns Number of sessions cleaned up
     */
    cleanupInactive(maxAge?: number): number {
        const cutoff = Date.now() - (maxAge ?? this.options.maxInactiveAge);
        let cleaned = 0;
        const toRemove: string[] = [];
        
        this.sessions.forEach((session, sessionId) => {
            if (session.lastActivity.getTime() < cutoff) {
                toRemove.push(sessionId);
                this.log(
                    `Session cleaned up (inactive): ${sessionId}`,
                    `Client: ${session.clientInfo?.name ?? 'unknown'}`,
                    `Last activity: ${session.lastActivity.toISOString()}`
                );
            }
        });
        
        toRemove.forEach(sessionId => {
            this.sessions.delete(sessionId);
            cleaned++;
        });
        
        if (cleaned > 0) {
            this.log(`Cleaned up ${cleaned} inactive session(s)`);
        }
        
        return cleaned;
    }
    
    /**
     * Get all active sessions (for debugging/monitoring)
     * 
     * @returns Array of all session contexts
     */
    listSessions(): SessionContext[] {
        const sessions: SessionContext[] = [];
        this.sessions.forEach(session => {
            sessions.push(session);
        });
        return sessions;
    }
    
    /**
     * Get session count
     * 
     * @returns Number of active sessions
     */
    getSessionCount(): number {
        return this.sessions.size;
    }
    
    /**
     * Determine provider mode for a session
     * 
     * Priority order:
     * 1. If client supports sampling → 'sampling'
     * 2. If API keys available → 'direct'
     * 3. Otherwise → 'none'
     * 
     * This detection is 100% automatic - no user configuration required.
     * 
     * @param context - Session context
     * @returns Provider mode
     */
    private determineProviderMode(context: SessionContext): ProviderMode {
        // Priority 1: Check if client supports sampling
        if (context.samplingAvailable) {
            this.log(
                'Provider mode detection:',
                'Client supports MCP sampling → using sampling mode',
                `(no API keys needed)`
            );
            return 'sampling';
        }
        
        // Priority 2: Check if direct provider available (API keys)
        const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
        const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
        const hasGoogleKey = !!process.env.GOOGLE_API_KEY;
        const hasApiKeys = hasAnthropicKey || hasOpenAIKey || hasGoogleKey;
        
        if (hasApiKeys) {
            const availableProviders: string[] = [];
            if (hasAnthropicKey) availableProviders.push('Anthropic');
            if (hasOpenAIKey) availableProviders.push('OpenAI');
            if (hasGoogleKey) availableProviders.push('Google');
            
            this.log(
                'Provider mode detection:',
                'Client does not support sampling → using direct API mode',
                `Available providers: ${availableProviders.join(', ')}`
            );
            return 'direct';
        }
        
        // Priority 3: No AI generation available
        this.log(
            'Provider mode detection:',
            'No AI provider available',
            'Client does not support sampling and no API keys found',
            'AI generation features will not be available'
        );
        return 'none';
    }
    
    /**
     * Log debug information
     */
    private log(...messages: string[]): void {
        if (this.options.debug) {
            // eslint-disable-next-line no-console
            console.log('[SessionManager]', ...messages);
        }
    }
}

/**
 * Generate a unique session ID
 * 
 * @returns UUID v4 session identifier
 */
export function generateSessionId(): string {
    return randomUUID();
}

/**
 * Create a default SessionManager instance
 * 
 * @param options - Configuration options
 * @returns SessionManager instance
 */
export function createSessionManager(options?: SessionManagerOptions): SessionManager {
    return new SessionManager(options);
}
