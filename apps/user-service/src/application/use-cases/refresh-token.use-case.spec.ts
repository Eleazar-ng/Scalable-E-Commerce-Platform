import { UnauthorizedException } from '@ecommerce-platform/common';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { UserRepositoryPort } from '../ports/user-repository.port';
import { TokenServicePort } from '../ports/token-service.port';
import { RefreshTokenBlocklistPort } from '../ports/refresh-token-blocklist.port';
import { JwtConfig } from '../../infrastructure/security/jwt.config';

function buildUser(): User {
  return User.register({
    email: Email.create('jane@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$hash'),
    firstName: 'Jane',
    lastName: 'Doe',
  });
}

function buildMocks() {
  const tokenService: jest.Mocked<TokenServicePort> = {
    signAccessToken: jest.fn().mockResolvedValue('new-access-token'),
    signRefreshToken: jest.fn().mockResolvedValue({ token: 'new-refresh-token', jti: 'new-jti' }),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const blocklist: jest.Mocked<RefreshTokenBlocklistPort> = {
    block: jest.fn(),
    isBlocked: jest.fn().mockResolvedValue(false),
  };
  const userRepository: jest.Mocked<UserRepositoryPort> = {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    createWithOutboxEvents: jest.fn(),
  };
  const jwtConfig: JwtConfig = {
    privateKeyPem: '',
    publicKeyPem: '',
    issuer: 'user-service',
    audience: 'ecommerce-platform',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
  };

  return { tokenService, blocklist, userRepository, jwtConfig };
}

describe('RefreshTokenUseCase', () => {
  it('rotates: blocklists the old jti and issues a new access+refresh token pair', async () => {
    const { tokenService, blocklist, userRepository, jwtConfig } = buildMocks();
    const user = buildUser();
    tokenService.verifyRefreshToken.mockResolvedValue({ sub: user.id, jti: 'old-jti' });
    userRepository.findById.mockResolvedValue(user);
    const useCase = new RefreshTokenUseCase(tokenService, blocklist, userRepository, jwtConfig);

    const result = await useCase.execute('some-refresh-token');

    expect(blocklist.block).toHaveBeenCalledWith('old-jti', 604800); // 7d in seconds
    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
  });

  it('throws UnauthorizedException if the jti is already blocklisted', async () => {
    const { tokenService, blocklist, userRepository, jwtConfig } = buildMocks();
    tokenService.verifyRefreshToken.mockResolvedValue({ sub: 'user-1', jti: 'revoked-jti' });
    blocklist.isBlocked.mockResolvedValue(true);
    const useCase = new RefreshTokenUseCase(tokenService, blocklist, userRepository, jwtConfig);

    await expect(useCase.execute('revoked-token')).rejects.toThrow(UnauthorizedException);
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException if the user no longer exists', async () => {
    const { tokenService, blocklist, userRepository, jwtConfig } = buildMocks();
    tokenService.verifyRefreshToken.mockResolvedValue({ sub: 'deleted-user', jti: 'jti-1' });
    userRepository.findById.mockResolvedValue(null);
    const useCase = new RefreshTokenUseCase(tokenService, blocklist, userRepository, jwtConfig);

    await expect(useCase.execute('some-token')).rejects.toThrow(UnauthorizedException);
  });

  it('propagates verification failure (expired/invalid token) from TokenServicePort', async () => {
    const { tokenService, blocklist, userRepository, jwtConfig } = buildMocks();
    tokenService.verifyRefreshToken.mockRejectedValue(new UnauthorizedException('expired'));
    const useCase = new RefreshTokenUseCase(tokenService, blocklist, userRepository, jwtConfig);

    await expect(useCase.execute('expired-token')).rejects.toThrow(UnauthorizedException);
  });
});
