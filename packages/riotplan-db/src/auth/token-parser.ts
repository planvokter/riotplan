/**
 * Token format: rpat_<8-char-id>_<32-char-secret>
 * - Prefix: "rpat_"
 * - ID: exactly 8 Base62 characters
 * - Separator: "_"
 * - Secret: exactly 32 Base62 characters
 */
const TOKEN_PATTERN = /^rpat_([A-Za-z0-9]{8})_([A-Za-z0-9]{32})$/;

/**
 * Parse and validate a raw token string.
 *
 * @param raw - The raw token string (e.g. "rpat_aBcD1234_eFgH5678...")
 * @returns Object with `id` and `secret` if valid, or `null` if the format doesn't match
 */
export function parseToken(
  raw: string,
): { id: string; secret: string } | null {
  const match = raw.match(TOKEN_PATTERN);
  if (!match) {
    return null;
  }
  return {
    id: match[1],
    secret: match[2],
  };
}
