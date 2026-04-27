/**
 * Token verification using @planvokter/riotplan-db interfaces.
 *
 * This module is cloud-provider-agnostic. It depends only on the
 * ITokenRepository interface from @planvokter/riotplan-db.
 *
 * The concrete implementation (e.g. FirestoreTokenRepository from
 * @planvokter/riotplan-db-firestore) is injected at deployment time
 * via the `tokenRepository` config option — keeping cloud deps out
 * of the public package.
 */

import type { ITokenRepository } from '@planvokter/riotplan-db';
import { parseToken, verifyToken } from '@planvokter/riotplan-db';
import type { AuthContext } from './rbac.js';

/**
 * Configuration for token verification.
 * The caller must provide an ITokenRepository instance —
 * this module does NOT create one.
 */
export interface TokenAuthConfig {
    tokenRepository: ITokenRepository;
}

/**
 * Verify a raw token string against the injected token repository.
 *
 * @param rawToken - The raw token string (e.g. "rpat_3Kh5LkhD_...")
 * @param config - Token auth config with injected repository
 * @returns AuthContext if valid, null if not
 */
export async function verifyTokenAuth(
    rawToken: string,
    config: TokenAuthConfig,
): Promise<AuthContext | null> {
    try {
        const parsed = parseToken(rawToken);
        if (!parsed) {
            return null;
        }

        const token = await config.tokenRepository.get(parsed.id);
        if (!token || !token.enabled) {
            return null;
        }

        // Check expiration
        if (token.expiresAt && token.expiresAt < new Date()) {
            return null;
        }

        // Verify the secret hash
        const valid = await verifyToken(parsed.secret, token.secretHash);
        if (!valid) {
            return null;
        }

        // Update lastUsedAt (fire-and-forget)
        config.tokenRepository.update(parsed.id, { lastUsedAt: new Date() }).catch(() => {
            // Silently ignore update failures
        });

        const isAdmin = token.scopes.includes('*') || token.scopes.includes('admin');

        return {
            user_id: token.userId,
            key_id: token.id,
            roles: isAdmin ? ['admin'] : token.scopes.map(s => `scope:${s}`),
            allowed_projects: token.allowedProjects,
        };
    } catch (err) {
        console.error('Token verification error:', err);
        return null;
    }
}
