import { ForbiddenException, UnauthorizedException } from '@ecommerce-platform/common';
import { LoginUseCase } from './login.use-case';
import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { UserRepositoryPort } from '../ports/user-repository.port';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { TokenServicePort } from '../ports/token-service.port';

function buildUser(): User {
  return User.register({
    email: Email.create('jane@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$storedhash'),
    firstName: 'Jane',
    lastName: 'Doe',
  });
}

function buildMocks() {
  const userRepository: jest.Mocked<UserRepositoryPort> = {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    createWithOutboxEvents: jest.fn(),
  };
  const passwordHasher: jest.Mocked<PasswordHasherPort> = {
    hash: jest.fn(),
    verify: jest.fn(),
  };
  const tokenService: jest.Mocked<TokenServicePort> = {
    signAccessToken: jest.fn().mockResolvedValue('access-token'),
    signRefreshToken: jest.fn().mockResolvedValue({ token: 'refresh-token', jti: 'jti-1' }),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  return { userRepository, passwordHasher, tokenService };
}

describe('LoginUseCase', () => {
  it('returns tokens on valid credentials', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(buildUser());
    passwordHasher.verify.mockResolvedValue(true);
    const useCase = new LoginUseCase(userRepository, passwordHasher, tokenService);

    const result = await useCase.execute({ email: 'jane@example.com', password: 'correct' });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
  });

  it('throws UnauthorizedException when no user is found for the email', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(null);
    const useCase = new LoginUseCase(userRepository, passwordHasher, tokenService);

    await expect(
      useCase.execute({ email: 'nobody@example.com', password: 'x' })
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException on a wrong password, with the SAME error as user-not-found', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(buildUser());
    passwordHasher.verify.mockResolvedValue(false);
    const useCase = new LoginUseCase(userRepository, passwordHasher, tokenService);

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'wrong' })
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('throws ForbiddenException for a suspended account with correct credentials', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    const user = buildUser();
    user.suspend();
    userRepository.findByEmail.mockResolvedValue(user);
    passwordHasher.verify.mockResolvedValue(true);
    const useCase = new LoginUseCase(userRepository, passwordHasher, tokenService);

    await expect(
      useCase.execute({ email: 'jane@example.com', password: 'correct' })
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not issue tokens when authentication fails', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(null);
    const useCase = new LoginUseCase(userRepository, passwordHasher, tokenService);

    await expect(useCase.execute({ email: 'x@example.com', password: 'x' })).rejects.toThrow();
    expect(tokenService.signAccessToken).not.toHaveBeenCalled();
  });
});
