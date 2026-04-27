/**
 * Firestore-based token verification for the MCP server.
 *
 * Uses @planvokter/riotplan-db and @planvokter/riotplan-db-firestore
 * to verify Personal Access Tokens (rpat_ format) against Firestore.
 */

import { getFirestoreClient, FirestoreTokenRepository } from '@planvokter/riotplan-db-firestore';
import type { FirestoreClientOptions } from '@planvokter/riotplan-db-firestore';
import type { AuthContext } from './rbac.js';

export interface FirestoreAuthConfig extends FirestoreClientOptions {}

let tokenRepo: FirestoreTokenRepository | null = null;

function getTokenRepo(config: FirestoreAuthConfig): FirestoreTokenRepository {
    if (!tokenRepo) {
        const db = getFirestoreClient(config);
        tokenRepo = new FirestoreTokenRepository(db);
    }
    return tokenRepo;
}

/**
 * Verify a raw token string against Firestore.
 *
 * @param rawToken - The raw token string (e.g. "rpat_3Kh5LkhD_...")
 * @param config - Firestore connection config
 * @returns AuthContext if valid, null if not
 */
export async function verifyFirestoreToken(
    rawToken: string,
    config: FirestoreAuthConfig,
): Promise<AuthContext | null> {
    try {
        const repo = getTokenRepo(config);
        const token = await repo.verifyRawToken(rawToken);

        if (!token) {
            return null;
        }

        const isAdmin = token.scopes.includes('*') || token.scopes.includes('admin');

        return {
            user_id: token.userId,
            key_id: token.id,
            roles: isAdmin ? ['admin'] : token.scopes.map(s => `scope:${s}`),
            allowed_projects: token.allowedProjects,
        };
    } catch (err) {
        console.error('Firestore token verification error:', err);
        return null;
    }
}
