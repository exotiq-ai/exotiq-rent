import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Tokens travel in links (confirm, unsubscribe); only their SHA-256 is
 * stored, so a read of the table cannot forge either link.
 */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** A token is 43 base64url chars; reject anything else before touching the store. */
export function looksLikeToken(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{40,48}$/.test(value);
}

/** Consent evidence: the IP is kept only as a salted hash. */
export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Unsubscribe tokens are derived, not stored: HMAC(secret, renter id). Every
 * e-mail can carry one without a lookup, and nothing in the table can mint
 * one. Rotating the secret retires every old link at once.
 */
export function unsubscribeToken(renterId: string, secret: string): string {
  return createHmac('sha256', secret).update(`unsubscribe|${renterId}`).digest('base64url');
}
