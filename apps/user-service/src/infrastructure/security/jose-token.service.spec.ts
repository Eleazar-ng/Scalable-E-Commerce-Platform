import { generateKeyPairSync } from 'crypto';
import { JoseTokenService } from './jose-token.service';
import { JwtConfig } from './jwt.config';

function buildConfig(overrides: Partial<JwtConfig> = {}): JwtConfig {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    issuer: 'user-service',
    audience: 'ecommerce-platform',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    ...overrides,
  };
}

describe('JoseTokenService', () => {
  it('signs and verifies an access token round-trip', async () => {
    const service = new JoseTokenService(buildConfig());
    const token = await service.signAccessToken({
      sub: 'user-123',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    const payload = await service.verifyAccessToken(token);
    expect(payload).toEqual({ sub: 'user-123', email: 'jane@example.com', role: 'CUSTOMER' });
  });

  it('signs and verifies a refresh token round-trip, generating a jti', async () => {
    const service = new JoseTokenService(buildConfig());
    const { token, jti } = await service.signRefreshToken({ sub: 'user-123' });

    const payload = await service.verifyRefreshToken(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.jti).toBe(jti);
  });

  it('generates a different jti for every refresh token', async () => {
    const service = new JoseTokenService(buildConfig());
    const a = await service.signRefreshToken({ sub: 'user-123' });
    const b = await service.signRefreshToken({ sub: 'user-123' });
    expect(a.jti).not.toBe(b.jti);
  });

  it('rejects a token signed with a different key pair', async () => {
    const serviceA = new JoseTokenService(buildConfig());
    const serviceB = new JoseTokenService(buildConfig()); // different generated keypair

    const token = await serviceA.signAccessToken({
      sub: 'user-123',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    await expect(serviceB.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a token with the wrong audience', async () => {
    const config = buildConfig();
    const issuer = new JoseTokenService(config);
    const verifier = new JoseTokenService({ ...config, audience: 'different-audience' });

    const token = await issuer.signAccessToken({
      sub: 'user-123',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    await expect(verifier.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects an expired token', async () => {
    const service = new JoseTokenService(buildConfig({ accessTokenTtl: '1 second' }));
    const token = await service.signAccessToken({
      sub: 'user-123',
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await expect(service.verifyAccessToken(token)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a malformed token string', async () => {
    const service = new JoseTokenService(buildConfig());
    await expect(service.verifyAccessToken('not.a.jwt')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
