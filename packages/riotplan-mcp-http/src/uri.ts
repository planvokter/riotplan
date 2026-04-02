/**
 * URI Parsing for RiotPlan Resources
 */

import type { RiotplanUri } from './types.js';

/**
 * Parse a riotplan:// URI into its components
 * 
 * Examples:
 * - riotplan://plan/path/to/plan
 * - riotplan://status/path/to/plan
 * - riotplan://steps/path/to/plan
 * - riotplan://step/path/to/plan?number=3
 */
export function parseUri(uri: string): RiotplanUri {
    if (!uri.startsWith('riotplan://')) {
        throw new Error(`Invalid riotplan URI: ${uri}`);
    }

    const withoutScheme = uri.slice('riotplan://'.length);
    const [typeAndPath, queryString] = withoutScheme.split('?');
    const parts = typeAndPath.split('/');
    const type = parts[0] as RiotplanUri['type'];
    const path = parts.slice(1).join('/') || undefined;

    // Parse query string
    const query: Record<string, string> = {};
    if (queryString) {
        const params = new URLSearchParams(queryString);
        for (const [key, value] of params.entries()) {
            query[key] = value;
        }
    }

    return {
        scheme: 'riotplan',
        type,
        path,
        query: Object.keys(query).length > 0 ? query : undefined,
    };
}

/**
 * Build a riotplan:// URI from components
 */
export function buildUri(
    type: RiotplanUri['type'],
    path?: string,
    query?: Record<string, string>
): string {
    let uri = `riotplan://${type}`;
    
    if (path) {
        uri += `/${path}`;
    }

    if (query && Object.keys(query).length > 0) {
        const params = new URLSearchParams(query);
        uri += `?${params.toString()}`;
    }

    return uri;
}
