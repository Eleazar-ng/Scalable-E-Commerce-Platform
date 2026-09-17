import { randomUUID } from 'crypto';
import { Email } from './value-objects/email.vo';
import { PasswordHash } from './value-objects/password-hash.vo';
import { UserDomainEvent } from './user-domain-event';
import {
  InvalidUserNameException,
  UserAlreadyActiveException,
  UserAlreadyDeletedException,
  UserAlreadySuspendedException,
  UserIsDeletedException,
} from './user.errors';

export type UserRole = 'CUSTOMER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export interface UserProps {
  id: string;
  email: Email;
  passwordHash: PasswordHash;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * The User aggregate root. Owns every invariant about a user's identity,
 * credentials, and status - nothing outside this class should mutate those
 * fields directly. The aggregate generates its own id at registration time
 * (rather than relying on the database to assign one) so the same id can
 * be used consistently in the domain event raised at registration and the
 * row persisted in the same transaction.
 */
export class User {
  private readonly domainEvents: UserDomainEvent[] = [];

  private constructor(private props: UserProps) {}

  static register(params: {
    email: Email;
    passwordHash: PasswordHash;
    firstName: string;
    lastName: string;
  }): User {
    const firstName = params.firstName.trim();
    const lastName = params.lastName.trim();

    if (firstName.length === 0) {
      throw new InvalidUserNameException('firstName');
    }
    if (lastName.length === 0) {
      throw new InvalidUserNameException('lastName');
    }

    const now = new Date();
    const user = new User({
      id: randomUUID(),
      email: params.email,
      passwordHash: params.passwordHash,
      firstName,
      lastName,
      role: 'CUSTOMER',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    });

    user.domainEvents.push({
      type: 'UserRegistered',
      userId: user.props.id,
      email: user.props.email.toString(),
      firstName: user.props.firstName,
    });

    return user;
  }

  /**
   * Reconstructs a User from persisted state (e.g. a Prisma row). No
   * validation is re-run here and no domain events are raised - this is
   * purely rehydration, not a business operation.
   */
  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  suspend(): void {
    this.assertNotDeleted();
    if (this.props.status === 'SUSPENDED') {
      throw new UserAlreadySuspendedException(this.props.id);
    }
    this.props.status = 'SUSPENDED';
    this.props.updatedAt = new Date();
  }

  reactivate(): void {
    this.assertNotDeleted();
    if (this.props.status === 'ACTIVE') {
      throw new UserAlreadyActiveException(this.props.id);
    }
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  changePasswordHash(newHash: PasswordHash): void {
    this.assertNotDeleted();
    this.props.passwordHash = newHash;
    this.props.updatedAt = new Date();
  }

  updateName(firstName: string, lastName: string): void {
    this.assertNotDeleted();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst.length === 0) {
      throw new InvalidUserNameException('firstName');
    }
    if (trimmedLast.length === 0) {
      throw new InvalidUserNameException('lastName');
    }

    this.props.firstName = trimmedFirst;
    this.props.lastName = trimmedLast;
    this.props.updatedAt = new Date();
  }

  /**
   * Soft-deletes the user - sets deletedAt rather than removing the row,
   * AND anonymizes the email to a tombstone value. The anonymization is
   * what actually frees the original email for reuse by a future
   * registration - without it, the database's unique constraint on email
   * would still see the deleted row as occupying that address forever.
   * This also doubles as a reasonable privacy practice (not retaining a
   * deleted account's real email indefinitely).
   *
   * Once deleted, no other mutating operation is permitted on this
   * aggregate (enforced by assertNotDeleted() in every mutator above).
   */
  softDelete(): void {
    if (this.props.deletedAt !== null) {
      throw new UserAlreadyDeletedException(this.props.id);
    }
    this.props.deletedAt = new Date();
    this.props.email = this.buildTombstoneEmail();
    this.props.updatedAt = new Date();
  }

  private buildTombstoneEmail(): Email {
    // randomUUID guarantees this can never collide with a real address or
    // with another deleted user's tombstone, so it always satisfies the
    // unique constraint. ".invalid" is the IANA-reserved TLD for addresses
    // that are guaranteed not to resolve (RFC 2606) - appropriate for a
    // value that must never actually be mailable.
    return Email.create(`deleted-${randomUUID()}@tombstone.invalid`);
  }

  private assertNotDeleted(): void {
    if (this.props.deletedAt !== null) {
      throw new UserIsDeletedException(this.props.id);
    }
  }

  pullDomainEvents(): UserDomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }

  get id(): string {
    return this.props.id;
  }

  get email(): Email {
    return this.props.email;
  }

  get passwordHash(): PasswordHash {
    return this.props.passwordHash;
  }

  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get isDeleted(): boolean {
    return this.props.deletedAt !== null;
  }

  /** Plain-object snapshot, e.g. for persistence mapping in the adapter layer. */
  toSnapshot(): UserProps {
    return { ...this.props };
  }
}
