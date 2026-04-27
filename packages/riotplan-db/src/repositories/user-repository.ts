import type { User } from '../types/user.js';

export interface IUserRepository {
  get(id: string): Promise<User | null>;
  findByOAuth(provider: string, subject: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  upsert(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
  list(options?: { role?: string; enabled?: boolean }): Promise<User[]>;
  delete(id: string): Promise<void>;
}
