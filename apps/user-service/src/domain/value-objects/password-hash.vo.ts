import { ValidationException } from '@ecommerce-platform/common';

/**
 * Value object wrapping an already-hashed password. The domain layer never
 * sees or handles plaintext passwords, and never performs hashing itself -
 * that's an infrastructure concern, handled by the argon2id adapter built
 * in Stage 2.2. This keeps the domain model free of a crypto dependency
 * and trivially testable.
 *
 * `PasswordHash.fromHash` trusts its input is already a valid hash string
 * (produced by the hashing adapter) - it only guards against the trivial
 * mistake of constructing one from an empty string.
 */
export class PasswordHash {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static fromHash(hash: string): PasswordHash {
    if (!hash || hash.trim().length === 0) {
      throw new ValidationException('Password hash cannot be empty');
    }
    return new PasswordHash(hash);
  }

  toString(): string {
    return this.value;
  }
}
