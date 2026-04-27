import type { IUserRepository } from './repositories/user-repository.js';
import type { ITokenRepository } from './repositories/token-repository.js';

export interface IDbFactory {
  users: IUserRepository;
  tokens: ITokenRepository;
  // Future:
  // notes: INoteRepository;
  // plans: IPlanRepository;
}
