import { Email } from './value-objects/email.vo';
import { PasswordHash } from './value-objects/password-hash.vo';
import { User } from './user.aggregate';
import {
  InvalidUserNameException,
  UserAlreadyActiveException,
  UserAlreadyDeletedException,
  UserAlreadySuspendedException,
  UserIsDeletedException,
} from './user.errors';

function buildValidRegisterParams(overrides: Partial<{ firstName: string; lastName: string }> = {}) {
  return {
    email: Email.create('jane@example.com'),
    passwordHash: PasswordHash.fromHash('$argon2id$fakehash'),
    firstName: overrides.firstName ?? 'Jane',
    lastName: overrides.lastName ?? 'Doe',
  };
}

describe('User.register', () => {
  it('creates a user with ACTIVE status and CUSTOMER role by default', () => {
    const user = User.register(buildValidRegisterParams());
    expect(user.status).toBe('ACTIVE');
    expect(user.role).toBe('CUSTOMER');
    expect(user.fullName).toBe('Jane Doe');
  });

  it('generates a unique id for each registered user', () => {
    const a = User.register(buildValidRegisterParams());
    const b = User.register(buildValidRegisterParams());
    expect(a.id).not.toBe(b.id);
  });

  it('trims whitespace from names', () => {
    const user = User.register(buildValidRegisterParams({ firstName: '  Jane  ', lastName: '  Doe  ' }));
    expect(user.fullName).toBe('Jane Doe');
  });

  it('rejects an empty first name', () => {
    expect(() => User.register(buildValidRegisterParams({ firstName: '' }))).toThrow(
      InvalidUserNameException
    );
  });

  it('rejects a whitespace-only last name', () => {
    expect(() => User.register(buildValidRegisterParams({ lastName: '   ' }))).toThrow(
      InvalidUserNameException
    );
  });

  it('raises a UserRegistered domain event', () => {
    const user = User.register(buildValidRegisterParams());
    const events = user.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'UserRegistered',
      userId: user.id,
      email: 'jane@example.com',
      firstName: 'Jane',
    });
  });

  it('clears domain events after they are pulled', () => {
    const user = User.register(buildValidRegisterParams());
    user.pullDomainEvents();
    expect(user.pullDomainEvents()).toHaveLength(0);
  });
});

describe('User status transitions', () => {
  it('suspend() transitions ACTIVE -> SUSPENDED', () => {
    const user = User.register(buildValidRegisterParams());
    user.suspend();
    expect(user.status).toBe('SUSPENDED');
  });

  it('suspend() throws if already suspended', () => {
    const user = User.register(buildValidRegisterParams());
    user.suspend();
    expect(() => user.suspend()).toThrow(UserAlreadySuspendedException);
  });

  it('reactivate() transitions SUSPENDED -> ACTIVE', () => {
    const user = User.register(buildValidRegisterParams());
    user.suspend();
    user.reactivate();
    expect(user.status).toBe('ACTIVE');
  });

  it('reactivate() throws if already active', () => {
    const user = User.register(buildValidRegisterParams());
    expect(() => user.reactivate()).toThrow(UserAlreadyActiveException);
  });

  it('updates updatedAt on a status transition', () => {
    const user = User.register(buildValidRegisterParams());
    const originalUpdatedAt = user.updatedAt;

    // Force a measurable time difference
    jest.useFakeTimers().setSystemTime(new Date(originalUpdatedAt.getTime() + 1000));
    user.suspend();
    jest.useRealTimers();

    expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});

describe('User.changePasswordHash', () => {
  it('replaces the password hash and updates updatedAt', () => {
    const user = User.register(buildValidRegisterParams());
    const originalUpdatedAt = user.updatedAt;
    const newHash = PasswordHash.fromHash('$argon2id$newhash');

    jest.useFakeTimers().setSystemTime(new Date(originalUpdatedAt.getTime() + 1000));
    user.changePasswordHash(newHash);
    jest.useRealTimers();

    expect(user.passwordHash.toString()).toBe('$argon2id$newhash');
    expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});

describe('User.softDelete', () => {
  it('sets deletedAt and isDeleted becomes true', () => {
    const user = User.register(buildValidRegisterParams());
    expect(user.isDeleted).toBe(false);

    user.softDelete();

    expect(user.isDeleted).toBe(true);
    expect(user.deletedAt).not.toBeNull();
  });

  it('throws if already deleted', () => {
    const user = User.register(buildValidRegisterParams());
    user.softDelete();
    expect(() => user.softDelete()).toThrow(UserAlreadyDeletedException);
  });

  it('updates updatedAt on delete', () => {
    const user = User.register(buildValidRegisterParams());
    const originalUpdatedAt = user.updatedAt;

    jest.useFakeTimers().setSystemTime(new Date(originalUpdatedAt.getTime() + 1000));
    user.softDelete();
    jest.useRealTimers();

    expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });

  it.each([
    ['suspend', (u: User) => u.suspend()],
    ['reactivate', (u: User) => u.reactivate()],
    ['changePasswordHash', (u: User) => u.changePasswordHash(PasswordHash.fromHash('$argon2id$x'))],
    ['softDelete', (u: User) => u.softDelete()],
  ])('blocks %s once the user is deleted', (_name, action) => {
    const user = User.register(buildValidRegisterParams());
    user.softDelete();

    expect(() => action(user)).toThrow(
      _name === 'softDelete' ? UserAlreadyDeletedException : UserIsDeletedException
    );
  });
});

describe('User.reconstitute', () => {
  it('rehydrates a user from persisted props without raising domain events', () => {
    const now = new Date();
    const user = User.reconstitute({
      id: 'existing-id',
      email: Email.create('existing@example.com'),
      passwordHash: PasswordHash.fromHash('$argon2id$existinghash'),
      firstName: 'Existing',
      lastName: 'User',
      role: 'ADMIN',
      status: 'SUSPENDED',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    expect(user.id).toBe('existing-id');
    expect(user.role).toBe('ADMIN');
    expect(user.status).toBe('SUSPENDED');
    expect(user.isDeleted).toBe(false);
    expect(user.pullDomainEvents()).toHaveLength(0);
  });

  it('rehydrates a deleted user correctly', () => {
    const now = new Date();
    const user = User.reconstitute({
      id: 'deleted-id',
      email: Email.create('deleted@example.com'),
      passwordHash: PasswordHash.fromHash('$argon2id$hash'),
      firstName: 'Deleted',
      lastName: 'User',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    });

    expect(user.isDeleted).toBe(true);
  });
});

describe('User.toSnapshot', () => {
  it('returns a plain-object snapshot matching the aggregate state', () => {
    const user = User.register(buildValidRegisterParams());
    const snapshot = user.toSnapshot();

    expect(snapshot.id).toBe(user.id);
    expect(snapshot.status).toBe('ACTIVE');
    expect(snapshot.email).toBe(user.email); // same Email instance reference
  });
});
