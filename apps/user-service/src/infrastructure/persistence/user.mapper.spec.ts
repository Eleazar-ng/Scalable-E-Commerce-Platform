import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { UserMapper, UserRow } from './user.mapper';

describe('UserMapper', () => {
  it('round-trips a newly registered user through toPersistence -> toDomain', () => {
    const original = User.register({
      email: Email.create('jane@example.com'),
      passwordHash: PasswordHash.fromHash('$argon2id$fakehash'),
      firstName: 'Jane',
      lastName: 'Doe',
    });

    const row = UserMapper.toPersistence(original);
    const rehydrated = UserMapper.toDomain(row);

    expect(rehydrated.id).toBe(original.id);
    expect(rehydrated.email.equals(original.email)).toBe(true);
    expect(rehydrated.passwordHash.toString()).toBe(original.passwordHash.toString());
    expect(rehydrated.fullName).toBe(original.fullName);
    expect(rehydrated.role).toBe(original.role);
    expect(rehydrated.status).toBe(original.status);
    expect(rehydrated.isDeleted).toBe(false);
  });

  it('does not raise domain events when reconstituting from a row', () => {
    const row: UserRow = {
      id: 'id-1',
      email: 'existing@example.com',
      passwordHash: '$argon2id$hash',
      firstName: 'Existing',
      lastName: 'User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    const user = UserMapper.toDomain(row);
    expect(user.pullDomainEvents()).toHaveLength(0);
  });

  it('maps a soft-deleted row correctly', () => {
    const deletedAt = new Date();
    const row: UserRow = {
      id: 'id-2',
      email: 'deleted@example.com',
      passwordHash: '$argon2id$hash',
      firstName: 'Deleted',
      lastName: 'User',
      role: 'ADMIN',
      status: 'SUSPENDED',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt,
    };

    const user = UserMapper.toDomain(row);
    expect(user.isDeleted).toBe(true);
    expect(user.deletedAt).toEqual(deletedAt);
    expect(user.role).toBe('ADMIN');
    expect(user.status).toBe('SUSPENDED');
  });

  it('toPersistence produces plain string values for email and passwordHash, not the value objects', () => {
    const user = User.register({
      email: Email.create('plain@example.com'),
      passwordHash: PasswordHash.fromHash('$argon2id$hash'),
      firstName: 'A',
      lastName: 'B',
    });

    const row = UserMapper.toPersistence(user);
    expect(typeof row.email).toBe('string');
    expect(typeof row.passwordHash).toBe('string');
  });
});
