import { ConflictException } from '@ecommerce-platform/common';
import { RegisterUserUseCase } from './register-user.use-case';
import { UserRepositoryPort } from '../ports/user-repository.port';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { TokenServicePort } from '../ports/token-service.port';

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
    hash: jest.fn().mockResolvedValue('$argon2id$hashed'),
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

const validInput = {
  email: 'jane@example.com',
  password: 'a-reasonably-strong-password',
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('RegisterUserUseCase', () => {
  it('registers a new user and returns tokens (auto-login)', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(null);
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);

    const result = await useCase.execute(validInput);

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.email).toBe('jane@example.com');
    expect(result.user.firstName).toBe('Jane');
  });

  it('hashes the plaintext password before persisting', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(null);
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);

    await useCase.execute(validInput);

    expect(passwordHasher.hash).toHaveBeenCalledWith(validInput.password);
  });

  it('throws ConflictException if the email is already registered', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue({} as any); // existing user found
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);

    await expect(useCase.execute(validInput)).rejects.toThrow(ConflictException);
    expect(userRepository.createWithOutboxEvents).not.toHaveBeenCalled();
  });

  it('persists the user and a UserRegistered outbox row atomically', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(null);
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);

    await useCase.execute(validInput);

    expect(userRepository.createWithOutboxEvents).toHaveBeenCalledTimes(1);
    const [, outboxRows] = userRepository.createWithOutboxEvents.mock.calls[0];
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0]).toMatchObject({
      aggregateType: 'User',
      eventType: 'UserRegistered',
      payload: expect.objectContaining({ email: 'jane@example.com', firstName: 'Jane' }),
    });
  });

  it('signs the access token with the correct subject, email, and role', async () => {
    const { userRepository, passwordHasher, tokenService } = buildMocks();
    userRepository.findByEmail.mockResolvedValue(null);
    const useCase = new RegisterUserUseCase(userRepository, passwordHasher, tokenService);

    const result = await useCase.execute(validInput);

    expect(tokenService.signAccessToken).toHaveBeenCalledWith({
      sub: result.user.id,
      email: 'jane@example.com',
      role: 'CUSTOMER',
    });
  });
});
