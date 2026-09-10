import { Injectable } from '@nestjs/common';
import { ExternalServiceException } from '@ecommerce-platform/common';
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

  async softDelete(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { deletedAt: new Date(), updatedAt: new Date() },
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

  private wrapError(operation: string, userId: string, error: unknown): ExternalServiceException {
    return new ExternalServiceException(`User repository ${operation} failed`, {
      retryable: true,
      context: { operation, userId },
      cause: error,
    });
  }
}
