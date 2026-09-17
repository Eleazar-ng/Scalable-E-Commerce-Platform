import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { NewOutboxRow } from '@ecommerce-platform/common';

/**
 * Repository port for the User aggregate (architecture decision 18).
 * Application/use-case code depends only on this interface - never on
 * Prisma directly. `PrismaUserRepository` (infrastructure/persistence)
 * is the concrete adapter satisfying it.
 *
 * findById/findByEmail exclude soft-deleted users by default, matching
 * the domain's soft-delete semantics - a deleted user should behave as
 * "not found" to the rest of the application.
 */
export interface UserRepositoryPort {
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
  /**
   * Persists a soft delete - takes the already-anonymized email from the
   * aggregate (User.softDelete() sets both deletedAt and a tombstone
   * email) rather than re-deriving it, so the domain stays the single
   * source of truth for what "deleted" means.
   */
  softDelete(userId: string, anonymizedEmail: Email): Promise<void>;
  findById(userId: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;

    /**
   * Inserts the user row and one or more outbox rows in a single database
   * transaction - the core of the Transactional Outbox pattern, solving
   * the dual-write problem (the event and the state change either both
   * commit or both roll back together). Used by RegisterUserUseCase to
   * persist the new user and record its UserRegistered event atomically.
   * The polling publisher that turns these outbox rows into Kafka messages
   * is built separately in Stage 3.2 and reused here once it exists.
   */
  createWithOutboxEvents(user: User, events: NewOutboxRow[]): Promise<void>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
