# @planvokter/riotplan-db

Abstract data access interfaces, types, and auth utilities for RiotPlan.

This package defines the **contracts** for the RiotPlan data access layer — interfaces, types, and pure-utility functions with zero cloud dependencies. Concrete implementations (e.g., `@planvokter/riotplan-db-firestore`) depend on this package and provide the actual storage backend.

## Installation

```bash
npm install @planvokter/riotplan-db
```

## Usage

```typescript
import type { IDbFactory, IUserRepository, ITokenRepository } from '@planvokter/riotplan-db';
import { generateToken, hashToken, parseToken, verifyToken } from '@planvokter/riotplan-db';
```

### Token Utilities

```typescript
// Generate a new personal access token
const { id, secret, rawToken } = generateToken();
// rawToken = "rpat_aBcD1234_eFgH5678..." (show once, then discard)

// Hash the secret for storage
const hash = await hashToken(secret);

// Verify a raw token later
const parsed = parseToken(rawToken); // { id: "aBcD1234", secret: "eFgH5678..." }
const valid = await verifyToken(parsed.secret, hash); // true
```

### Implementing a Backend

```typescript
import type { IDbFactory, IUserRepository, ITokenRepository } from '@planvokter/riotplan-db';

class MyUserRepository implements IUserRepository {
  // ...implement the interface methods
}

class MyTokenRepository implements ITokenRepository {
  // ...implement the interface methods
}

class MyDbFactory implements IDbFactory {
  users = new MyUserRepository();
  tokens = new MyTokenRepository();
}
```

## What's Here

| Module | Description |
|--------|-------------|
| `types/` | `User`, `PersonalAccessToken`, `TokenScope`, `TokenCreationResult` |
| `repositories/` | `IUserRepository`, `ITokenRepository` interfaces (+ future stubs) |
| `auth/` | Token hashing (scrypt), generation (`rpat_xxx_yyy`), parsing |
| `factory` | `IDbFactory` interface |

## License

Apache-2.0
