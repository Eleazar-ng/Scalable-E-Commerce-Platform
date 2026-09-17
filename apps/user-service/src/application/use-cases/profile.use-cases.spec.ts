import { NotFoundException } from '@ecommerce-platform/common';
import { GetProfileUseCase } from './get-profile.use-case';
import { UpdateProfileUseCase } from './update-profile.use-case';
import { DeleteAccountUseCase } from './delete-account.use-case';
import { User } from '../../domain/user.aggregate';
import { InvalidUserNameException } from '../../domain/user.errors';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { UserRepositoryPort } from '../ports/user-repository.port';

function buildUser(): User {
  return User.register({
    email: Email.create('jane@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$hash'),
    firstName: 'Jane',
    lastName: 'Doe',
  });
}

function buildRepoMock(): jest.Mocked<UserRepositoryPort> {
  return {
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    createWithOutboxEvents: jest.fn(),
  };
}

describe('GetProfileUseCase', () => {
  it('returns the profile for an existing user', async () => {
    const repo = buildRepoMock();
    const user = buildUser();
    repo.findById.mockResolvedValue(user);
    const useCase = new GetProfileUseCase(repo);

    const result = await useCase.execute(user.id);
    expect(result.email).toBe('jane@example.com');
  });

  it('throws NotFoundException when the user does not exist', async () => {
    const repo = buildRepoMock();
    repo.findById.mockResolvedValue(null);
    const useCase = new GetProfileUseCase(repo);

    await expect(useCase.execute('missing-id')).rejects.toThrow(NotFoundException);
  });
});

describe('UpdateProfileUseCase', () => {
  it('updates the name and persists via repository.update', async () => {
    const repo = buildRepoMock();
    const user = buildUser();
    repo.findById.mockResolvedValue(user);
    const useCase = new UpdateProfileUseCase(repo);

    const result = await useCase.execute({ userId: user.id, firstName: 'Janet', lastName: 'Smith' });

    expect(result.firstName).toBe('Janet');
    expect(result.lastName).toBe('Smith');
    expect(repo.update).toHaveBeenCalledWith(user);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    const repo = buildRepoMock();
    repo.findById.mockResolvedValue(null);
    const useCase = new UpdateProfileUseCase(repo);

    await expect(
      useCase.execute({ userId: 'missing', firstName: 'A', lastName: 'B' })
    ).rejects.toThrow(NotFoundException);
  });

  it('propagates domain validation errors (e.g. empty name) without persisting', async () => {
    const repo = buildRepoMock();
    const user = buildUser();
    repo.findById.mockResolvedValue(user);
    const useCase = new UpdateProfileUseCase(repo);

    await expect(
      useCase.execute({ userId: user.id, firstName: '', lastName: 'Smith' })
    ).rejects.toThrow(InvalidUserNameException);
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('DeleteAccountUseCase', () => {
  it('soft-deletes an existing user', async () => {
    const repo = buildRepoMock();
    const user = buildUser();
    repo.findById.mockResolvedValue(user);
    const useCase = new DeleteAccountUseCase(repo);

    const originalEmail = user.email.toString();
    await useCase.execute(user.id);

    // The email passed to the repository must be the POST-delete
    // (anonymized) email, not the original - proves the use-case persists
    // what the domain actually mutated, not a stale reference.
    expect(repo.softDelete).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ toString: expect.any(Function) })
    );
    const [, emailArg] = repo.softDelete.mock.calls[0];
    expect(emailArg.toString()).not.toBe(originalEmail);
    expect(emailArg.toString()).toMatch(/^deleted-.+@tombstone\.invalid$/);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    const repo = buildRepoMock();
    repo.findById.mockResolvedValue(null);
    const useCase = new DeleteAccountUseCase(repo);

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundException);
    expect(repo.softDelete).not.toHaveBeenCalled();
  });
});
