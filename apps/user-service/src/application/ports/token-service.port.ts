export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string; // user id
  jti: string; // unique token id - the key used in the Redis blocklist
}

/**
 * Port for JWT issuance/verification. Application/use-case code depends
 * only on this interface - never on `jose` or the raw signing keys
 * directly.
 */
export interface TokenServicePort {
  signAccessToken(payload: AccessTokenPayload): Promise<string>;
  signRefreshToken(payload: { sub: string }): Promise<{ token: string; jti: string }>;
  verifyAccessToken(token: string): Promise<AccessTokenPayload>;
  verifyRefreshToken(token: string): Promise<RefreshTokenPayload>;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');
