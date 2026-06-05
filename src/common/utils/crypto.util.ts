import { createHash, randomBytes } from 'crypto';

/** Generates a cryptographically-strong, URL-safe random token. */
export function generateRandomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Deterministically hashes opaque tokens (refresh / reset / verification)
 * before persisting them, so a database leak never exposes usable tokens.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
