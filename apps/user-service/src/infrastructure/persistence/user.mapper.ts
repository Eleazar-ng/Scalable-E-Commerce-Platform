import { User } from '../../domain/user.aggregate';
import { Email } from '../../domain/value-objects/email.vo';
import { PasswordHash } from '../../domain/value-objects/password-hash.vo';
import { UserRole,UserStatus } from '../../../generated/prisma/enums';

/**
 * Plain shape matching the generated Prisma `User` model. Defined by hand
 * here (rather than imported from the generated client) so this mapper
 * typechecks independently of whether `prisma generate` has been run -
 * PrismaUserRepository is responsible for satisfying this shape with the
 * real generated type at the call site.
 */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class UserMapper {
  static toDomain(row: UserRow): User {
    return User.reconstitute({
      id: row.id,
      email: Email.create(row.email),
      passwordHash: PasswordHash.fromHash(row.passwordHash),
      firstName: row.firstName,
      lastName: row.lastName,
      role: row.role as UserRole,
      status: row.status as UserStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    });
  }

  static toPersistence(user: User): UserRow {
    const snapshot = user.toSnapshot();
    return {
      id: snapshot.id,
      email: snapshot.email.toString(),
      passwordHash: snapshot.passwordHash.toString(),
      firstName: snapshot.firstName,
      lastName: snapshot.lastName,
      role: snapshot.role,
      status: snapshot.status,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      deletedAt: snapshot.deletedAt,
    };
  }
}
