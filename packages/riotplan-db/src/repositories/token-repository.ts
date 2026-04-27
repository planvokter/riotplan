import type { PersonalAccessToken } from '../types/token.js';

export interface ITokenRepository {
  get(id: string): Promise<PersonalAccessToken | null>;
  findByHash(secretHash: string): Promise<PersonalAccessToken | null>;
  create(
    token: Omit<PersonalAccessToken, 'createdAt' | 'lastUsedAt'> & { secretHash: string },
  ): Promise<PersonalAccessToken>;
  update(
    id: string,
    updates: Partial<
      Pick<
        PersonalAccessToken,
        | 'enabled'
        | 'lastUsedAt'
        | 'name'
        | 'scopes'
        | 'allowedProjects'
        | 'expiresAt'
      >
    >,
  ): Promise<PersonalAccessToken>;
  listByUser(userId: string): Promise<PersonalAccessToken[]>;
  revoke(id: string): Promise<void>; // Sets enabled=false
  delete(id: string): Promise<void>; // Hard delete
  updateSecret(id: string, secretHash: string): Promise<void>; // Replace the hashed secret
}
