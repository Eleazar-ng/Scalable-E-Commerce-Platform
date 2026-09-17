import { User } from '../../domain/user.aggregate';

/**
 * Plain-object shape returned to callers (REST controllers, eventually).
 * Deliberately excludes passwordHash - this is the only representation of
 * a User that ever leaves the application layer.
 */
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  createdAt: Date;
}

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}
