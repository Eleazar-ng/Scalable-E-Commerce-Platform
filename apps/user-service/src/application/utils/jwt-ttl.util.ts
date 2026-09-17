/**
 * Parses a compact jose-style time-span string ("7d", "15m", "1h", "30s")
 * into seconds. Only this compact form is supported - not jose's full
 * flexible grammar ("2 hours", "7 days") - since it's only ever fed this
 * project's own JWT_ACCESS_TOKEN_TTL/JWT_REFRESH_TOKEN_TTL env values,
 * which are always written in this compact form (see .env.example).
 *
 * Falls back to 7 days on an unparseable string rather than throwing, so a
 * misconfigured TTL degrades the blocklist duration rather than breaking
 * logout/refresh entirely.
 */
export function parseJwtTtlToSeconds(ttl: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(ttl.trim());
  if (!match) {
    return 7 * 24 * 60 * 60;
  }
  const [, amount, unit] = match;
  const multiplier: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return Number(amount) * multiplier[unit];
}
