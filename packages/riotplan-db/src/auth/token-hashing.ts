import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Scrypt parameters matching the existing rbac.ts configuration.
 */
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALTLEN = 16;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

/**
 * Hash format: scrypt$N$r$p$salt_base64$derived_base64
 */

/**
 * Parse a stored scrypt hash string into its components.
 */
function parseScryptHash(hash: string): {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  derivedKey: Buffer;
} | null {
  const parts = hash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return null;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N <= 1 ||
    r <= 0 ||
    p <= 0
  ) {
    return null;
  }
  const salt = Buffer.from(parts[4], 'base64');
  const derivedKey = Buffer.from(parts[5], 'base64');
  if (salt.length === 0 || derivedKey.length === 0) {
    return null;
  }
  return { N, r, p, salt, derivedKey };
}

/**
 * Hash a raw token secret using scrypt.
 * Returns a string in the format: scrypt$N$r$p$salt_base64$derived_base64
 */
export async function hashToken(secret: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALTLEN);
  const derived = scryptSync(secret, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/**
 * Verify a raw token secret against a stored scrypt hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyToken(
  secret: string,
  hash: string,
): Promise<boolean> {
  const parsed = parseScryptHash(hash);
  if (!parsed) {
    return false;
  }
  const computed = scryptSync(secret, parsed.salt, parsed.derivedKey.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: SCRYPT_MAXMEM,
  }) as Buffer;
  if (computed.length !== parsed.derivedKey.length) {
    return false;
  }
  return timingSafeEqual(computed, parsed.derivedKey);
}
