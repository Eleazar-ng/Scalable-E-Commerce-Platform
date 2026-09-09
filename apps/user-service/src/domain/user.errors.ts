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
