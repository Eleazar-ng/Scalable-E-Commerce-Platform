import { DomainException, ValidationException } from '@ecommerce-platform/common';

export class InvalidProductNameException extends ValidationException {
  constructor() {
    super('Product name cannot be empty');
  }
}

export class ProductAlreadyDiscontinuedException extends DomainException {
  constructor(productId: string) {
    super('Product is already discontinued', { productId });
  }
}

export class ProductAlreadyActiveException extends DomainException {
  constructor(productId: string) {
    super('Product is already active', { productId });
  }
}
