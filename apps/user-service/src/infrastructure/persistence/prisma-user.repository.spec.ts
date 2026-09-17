import { ConflictException } from '@ecommerce-platform/common';
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
    outbox: {
      create: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue(undefined),
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

  it('create() translates a Prisma P2002 (unique constraint) error into ConflictException', async () => {
    const prisma = buildPrismaMock();
    prisma.user.create.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });
    const repo = new PrismaUserRepository(prisma as any);

    await expect(repo.create(buildUser())).rejects.toBeInstanceOf(ConflictException);
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

  it('softDelete() persists the anonymized email alongside deletedAt', async () => {
    const prisma = buildPrismaMock();
    const repo = new PrismaUserRepository(prisma as any);
    const tombstoneEmail = Email.create('deleted-abc123@tombstone.invalid');

    await repo.softDelete('user-123', tombstoneEmail);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: expect.objectContaining({
        email: 'deleted-abc123@tombstone.invalid',
        deletedAt: expect.any(Date),
      }),
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

  describe('createWithOutboxEvents', () => {
    it('runs the user insert and outbox insert(s) inside a single $transaction call', async () => {
      const prisma = buildPrismaMock();
      const repo = new PrismaUserRepository(prisma as any);
      const user = buildUser();

      await repo.createWithOutboxEvents(user, [
        {
          aggregateType: 'User',
          aggregateId: user.id,
          eventType: 'UserRegistered',
          payload: { userId: user.id, email: 'jane@example.com', firstName: 'Jane' },
        },
      ]);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const operations = prisma.$transaction.mock.calls[0][0];
      expect(operations).toHaveLength(2); // user.create + outbox.create
      expect(prisma.user.create).toHaveBeenCalledWith({ data: UserMapper.toPersistence(user) });
      expect(prisma.outbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ eventType: 'UserRegistered', aggregateId: user.id }),
      });
    });

    it('supports multiple outbox events in the same transaction', async () => {
      const prisma = buildPrismaMock();
      const repo = new PrismaUserRepository(prisma as any);
      const user = buildUser();

      await repo.createWithOutboxEvents(user, [
        { aggregateType: 'User', aggregateId: user.id, eventType: 'EventA', payload: {} },
        { aggregateType: 'User', aggregateId: user.id, eventType: 'EventB', payload: {} },
      ]);

      const operations = prisma.$transaction.mock.calls[0][0];
      expect(operations).toHaveLength(3); // user.create + 2 outbox.create
    });

    it('translates a Prisma P2002 (unique constraint) error into ConflictException', async () => {
      const prisma = buildPrismaMock();
      prisma.$transaction.mockRejectedValue({ code: 'P2002', meta: { target: ['email'] } });
      const repo = new PrismaUserRepository(prisma as any);
      const user = buildUser();

      await expect(
        repo.createWithOutboxEvents(user, [
          { aggregateType: 'User', aggregateId: user.id, eventType: 'UserRegistered', payload: {} },
        ])
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('wraps a transaction failure in ExternalServiceException', async () => {
      const prisma = buildPrismaMock();
      prisma.$transaction.mockRejectedValue(new Error('unique constraint violation'));
      const repo = new PrismaUserRepository(prisma as any);
      const user = buildUser();

      await expect(
        repo.createWithOutboxEvents(user, [
          { aggregateType: 'User', aggregateId: user.id, eventType: 'UserRegistered', payload: {} },
        ])
      ).rejects.toMatchObject({
        code: 'EXTERNAL_SERVICE_ERROR',
        context: expect.objectContaining({ operation: 'createWithOutboxEvents' }),
      });
    });
  });
});
