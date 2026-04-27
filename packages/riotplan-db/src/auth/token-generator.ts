import { randomBytes } from 'node:crypto';

/**
 * Base62 character set (alphanumeric only) for token encoding.
 */
const BASE62_CHARS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Encode a Buffer as a Base62 string.
 */
function toBase62(buffer: Buffer): string {
  let num = 0n;
  for (const byte of buffer) {
    num = (num << 8n) | BigInt(byte);
  }
  if (num === 0n) return BASE62_CHARS[0];
  let result = '';
  const base = BigInt(BASE62_CHARS.length);
  while (num > 0n) {
    result = BASE62_CHARS[Number(num % base)] + result;
    num = num / base;
  }
  return result;
}

/**
 * Generate a random Base62 string of the specified length.
 */
function randomBase62(length: number): string {
  // Generate extra bytes and encode, then trim to desired length
  const byteLength = Math.ceil((length * 6) / 5); // slight overestimate
  let result = '';
  while (result.length < length) {
    result += toBase62(randomBytes(byteLength));
  }
  return result.slice(0, length);
}

/**
 * Token prefix identifying this as a RiotPlan personal access token.
 */
const TOKEN_PREFIX = 'rpat_';

/**
 * Length of the lookup ID portion of the token.
 */
const ID_LENGTH = 8;

/**
 * Length of the secret portion of the token.
 */
const SECRET_LENGTH = 32;

/**
 * Generate a new personal access token in the format: rpat_<8-char-id>_<32-char-secret>
 *
 * - The 8-char ID is the lookup key stored as `token.id` in the database
 * - The 32-char secret is the part that gets hashed for storage
 *
 * @returns Object with the `id` (lookup key), `secret` (to be hashed), and `rawToken` (full string)
 */
export function generateToken(): {
  id: string;
  secret: string;
  rawToken: string;
} {
  const id = randomBase62(ID_LENGTH);
  const secret = randomBase62(SECRET_LENGTH);
  const rawToken = `${TOKEN_PREFIX}${id}_${secret}`;
  return { id, secret, rawToken };
}
