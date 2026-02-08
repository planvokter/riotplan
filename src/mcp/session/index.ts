/**
 * Session Management for MCP Sampling Support
 * 
 * Provides session-based tracking of client capabilities to enable
 * automatic detection and use of MCP sampling when available.
 */

export {
    // Types
    type Transport,
    type ProviderMode,
    type ClientInfo,
    type SamplingCapability,
    type Capabilities,
    type SessionContext,
    
    // Type guards and utilities
    isProviderMode,
    isTransport,
    hasSamplingCapability,
    hasToolsInSampling,
} from './types.js';

export {
    // SessionManager
    SessionManager,
    createSessionManager,
    generateSessionId,
    
    // Types
    type InitializeRequest,
    type SessionManagerOptions,
} from './SessionManager.js';
