import { Injectable } from '@nestjs/common';
import { ConflictException, ExternalServiceException, NewOutboxRow } from '@ecommerce-platform/common';
import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { UserRepositoryPort } from '../../application/ports/user-repository.port';
import { PrismaService } from './prisma.service';
import { UserMapper } from './user.mapper';

/**
 * Prisma-backed implementation of UserRepositoryPort (architecture
 * decision 18). All Prisma-specific concerns - the client, error codes,
 * soft-delete filtering - are contained here; nothing above this layer
 * knows Prisma exists.
 *
 * NOTE: like prisma.service.ts, this file depends on PrismaService, which
 * depends on the generated Prisma Client - it will only typecheck once
 * `prisma generate` has been run locally (see that file's comment for why
 * it couldn't be run in this sandbox).
 */
@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user);
    try {
      await this.prisma.user.create({ data: row });
    } catch (error) {
      throw this.wrapError('create', user.id, error);
    }
  }

  async update(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user);
    try {
      await this.prisma.user.update({
        where: { id: row.id },
        data: {
          email: row.email,
          passwordHash: row.passwordHash,
          firstName: row.firstName,
          lastName: row.lastName,
          role: row.role,
          status: row.status,
          updatedAt: row.updatedAt,
          deletedAt: row.deletedAt,
        },
      });
    } catch (error) {
      throw this.wrapError('update', user.id, error);
    }
  }

  async softDelete(userId: string, anonymizedEmail: Email): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { email: anonymizedEmail.toString(), deletedAt: new Date(), updatedAt: new Date() },
      });
    } catch (error) {
      throw this.wrapError('softDelete', userId, error);
    }
  }

  async findById(userId: string): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const row = await this.prisma.user.findFirst({
      where: { email: email.toString(), deletedAt: null },
    });
    return row ? UserMapper.toDomain(row) : null;
  }

  async createWithOutboxEvents(user: User, events: NewOutboxRow[]): Promise<void> {
    const row = UserMapper.toPersistence(user);
    try {
      await this.prisma.$transaction([
        this.prisma.user.create({ data: row }),
        ...events.map((event) =>
          this.prisma.outbox.create({
            data: {
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              eventType: event.eventType,
              payload: event.payload as object,
            },
          })
        ),
      ]);
    } catch (error) {
      throw this.wrapError('createWithOutboxEvents', user.id, error);
    }
  }

  private wrapError(
    operation: string,
    userId: string,
    error: unknown
  ): ConflictException | ExternalServiceException {
    // Prisma's known-request errors carry a `code` like "P2002" for a
    // unique constraint violation. Duck-typed rather than imported from
    // the generated client, so this check works regardless of whether
    // `prisma generate` has been run in the current environment - and so
    // it's exercised by the mocked-client tests without needing the real
    // PrismaClientKnownRequestError class.
    if (this.isUniqueConstraintError(error)) {
      return new ConflictException('An account with this email already exists', { userId });
    }

    return new ExternalServiceException(`User repository ${operation} failed`, {
      retryable: true,
      context: { operation, userId },
      cause: error,
    });
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: unknown }).code === 'P2002'
    );
  }
}
