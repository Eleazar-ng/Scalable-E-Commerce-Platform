import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';

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
  softDelete(userId: string): Promise<void>;
  findById(userId: string): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
