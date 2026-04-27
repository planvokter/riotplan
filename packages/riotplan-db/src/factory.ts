import type { IUserRepository } from './repositories/user-repository.js';
import type { ITokenRepository } from './repositories/token-repository.js';
import type { IDocumentRepository } from './repositories/document-repository.js';

export interface IDbFactory {
  users: IUserRepository;
  tokens: ITokenRepository;
  documents: IDocumentRepository;
  // Future:
  // notes: INoteRepository;
  // plans: IPlanRepository;
}
