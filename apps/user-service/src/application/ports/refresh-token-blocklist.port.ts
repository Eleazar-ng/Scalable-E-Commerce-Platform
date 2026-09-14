/**
 * Port for the refresh-token revocation blocklist (architecture decision
 * 9: JWT with a Redis-backed blocklist). A blocked jti means that refresh
 * token has been revoked (logout, suspected compromise, etc.) even though
 * it hasn't naturally expired yet.
 */
export interface RefreshTokenBlocklistPort {
  /** Blocks a refresh token's jti until `ttlSeconds` from now. */
  block(jti: string, ttlSeconds: number): Promise<void>;
  isBlocked(jti: string): Promise<boolean>;
}

export const REFRESH_TOKEN_BLOCKLIST = Symbol('REFRESH_TOKEN_BLOCKLIST');
