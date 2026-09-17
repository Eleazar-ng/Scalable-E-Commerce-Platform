import { LogoutUseCase } from './logout.use-case';
import { TokenServicePort } from '../ports/token-service.port';
import { RefreshTokenBlocklistPort } from '../ports/refresh-token-blocklist.port';
import { JwtConfig } from '../../infrastructure/security/jwt.config';

function buildMocks() {
  const tokenService: jest.Mocked<TokenServicePort> = {
    signAccessToken: jest.fn(),
    signRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const blocklist: jest.Mocked<RefreshTokenBlocklistPort> = {
    block: jest.fn(),
    isBlocked: jest.fn(),
  };
  const jwtConfig: JwtConfig = {
    privateKeyPem: '',
    publicKeyPem: '',
    issuer: 'user-service',
    audience: 'ecommerce-platform',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
  };
  return { tokenService, blocklist, jwtConfig };
}

describe('LogoutUseCase', () => {
  it('blocklists the jti of a valid refresh token', async () => {
    const { tokenService, blocklist, jwtConfig } = buildMocks();
    tokenService.verifyRefreshToken.mockResolvedValue({ sub: 'user-1', jti: 'jti-1' });
    const useCase = new LogoutUseCase(tokenService, blocklist, jwtConfig);

    await useCase.execute('valid-token');

    expect(blocklist.block).toHaveBeenCalledWith('jti-1', 604800);
  });

  it('does not throw when given an already-invalid/expired refresh token', async () => {
    const { tokenService, blocklist, jwtConfig } = buildMocks();
    tokenService.verifyRefreshToken.mockRejectedValue(new Error('expired'));
    const useCase = new LogoutUseCase(tokenService, blocklist, jwtConfig);

    await expect(useCase.execute('garbage-token')).resolves.not.toThrow();
    expect(blocklist.block).not.toHaveBeenCalled();
  });
});
