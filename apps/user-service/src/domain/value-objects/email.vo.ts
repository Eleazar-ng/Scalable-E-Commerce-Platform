import { ValidationException } from '@ecommerce-platform/common';

// Deliberately simple - RFC 5322 compliant validation is notoriously
// difficult to get exactly right with a regex, and most real-world
// systems (this one included) rely on a pragmatic check plus, in
// production, a verification email as the actual proof the address works.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Value object wrapping a validated, normalized email address. Once
 * constructed, an Email instance is guaranteed to be well-formed - callers
 * never need to re-validate it.
 */
export class Email {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(rawEmail: string): Email {
    const normalized = rawEmail.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new ValidationException('Invalid email address', { email: rawEmail });
    }

    return new Email(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
