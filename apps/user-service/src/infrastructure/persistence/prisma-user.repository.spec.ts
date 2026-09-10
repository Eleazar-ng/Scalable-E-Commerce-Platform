import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { PrismaUserRepository } from './prisma-user.repository';
import { UserMapper } from './user.mapper';

function buildUser(): User {
  return User.register({
    email: Email.create('jane@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$hash'),
    firstName: 'Jane',
    lastName: 'Doe',
  });
}

function buildPrismaMock() {
  return {
    user: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
}

describe('PrismaUserRepository', () => {
  it('create() persists the mapped row', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaUserRepository(prisma as any);
    const user = buildUser();

    await repo.create(user);

    expect(prisma.user.create).toHaveBeenCalledWith({ data: UserMapper.toPersistence(user) });
  });

  it('create() wraps a Prisma failure in ExternalServiceException', async () => {
    const prisma = buildPrismaMock();
    prisma.user.create.mockRejectedValue(new Error('unique constraint violation'));
    const repo = new PrismaUserRepository(prisma as any);

    await expect(repo.create(buildUser())).rejects.toMatchObject({
      code: 'EXTERNAL_SERVICE_ERROR',
      context: expect.objectContaining({ operation: 'create' }),
    });
  });

  it('update() sends the current mapped fields, excluding id/createdAt', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaUserRepository(prisma as any);
    const user = buildUser();
    user.suspend();

    await repo.update(user);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: expect.objectContaining({ status: 'SUSPENDED' }),
    });
  });

  it('softDelete() sets deletedAt via a Prisma update', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaUserRepository(prisma as any);

    await repo.softDelete('user-123');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: expect.objectContaining({ deletedAt: expect.any(Date) }),
    });
  });

  it('findById() excludes soft-deleted rows via the query filter', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);
    const repo = new PrismaUserRepository(prisma as any);

    await repo.findById('user-123');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-123', deletedAt: null },
    });
  });

  it('findById() returns null when no row is found', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);
    const repo = new PrismaUserRepository(prisma as any);

    const result = await repo.findById('missing');
    expect(result).toBeNull();
  });

  it('findById() maps a found row back into a User aggregate', async () => {
    const prisma = buildPrismaMock();
    const row = UserMapper.toPersistence(buildUser());
    prisma.user.findFirst.mockResolvedValue(row);
    const repo = new PrismaUserRepository(prisma as any);

    const result = await repo.findById(row.id);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(row.id);
  });

  it('findByEmail() queries by normalized email string and excludes soft-deleted rows', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);
    const repo = new PrismaUserRepository(prisma as any);

    await repo.findByEmail(Email.create('Jane@Example.com'));

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: 'jane@example.com', deletedAt: null },
    });
  });
});
