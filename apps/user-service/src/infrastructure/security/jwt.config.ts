export const JWT_CONFIG = Symbol('JWT_CONFIG');

export interface JwtConfig {
  /** PEM-encoded Ed25519 private key (JWT_PRIVATE_KEY env var) */
  privateKeyPem: string;
  /** PEM-encoded Ed25519 public key (JWT_PUBLIC_KEY env var) */
  publicKeyPem: string;
  issuer: string;
  audience: string;
  /** e.g. "15m" - passed directly to jose's setExpirationTime */
  accessTokenTtl: string;
  /** e.g. "7d" */
  refreshTokenTtl: string;
}
