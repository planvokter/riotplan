export interface PersonalAccessToken {
  id: string; // 8-char lookup key (part of the token prefix)
  name: string; // User-given label like "CI Pipeline"
  userId: string; // Reference to User.id
  secretHash: string; // Scrypt hash of the secret portion
  enabled: boolean;
  scopes: TokenScope[];
  allowedProjects: string[]; // Project IDs this token can access, ['*'] for all
  expiresAt: Date | null; // null = never expires
  lastUsedAt: Date | null;
  createdAt: Date;
}

export type TokenScope = string;

/** Predefined scope strings for convenience */
export const Scopes = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin',
  READ_PLANS: 'read:plans',
  WRITE_PLANS: 'write:plans',
  READ_NOTES: 'read:notes',
  WRITE_NOTES: 'write:notes',
  MANAGE_TOKENS: 'manage:tokens',
  ALL: '*',
} as const;

export interface TokenCreationResult {
  token: PersonalAccessToken; // The stored record (with hash, no raw secret)
  rawSecret: string; // The full token string shown ONCE: rpat_xxx_yyy
}
