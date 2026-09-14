import { DomainException, ValidationException } from '@ecommerce-platform/common';

export class InvalidUserNameException extends ValidationException {
  constructor(field: 'firstName' | 'lastName') {
    super(`${field} cannot be empty`, { field });
  }
}

export class UserAlreadySuspendedException extends DomainException {
  constructor(userId: string) {
    super('User is already suspended', { userId });
  }
}

export class UserAlreadyActiveException extends DomainException {
  constructor(userId: string) {
    super('User is already active', { userId });
  }
}

export class UserAlreadyDeletedException extends DomainException {
  constructor(userId: string) {
    super('User is already deleted', { userId });
  }
}

export class UserIsDeletedException extends DomainException {
  constructor(userId: string) {
    super('Cannot modify a deleted user', { userId });
  }
}
