import { ValidationException } from '@ecommerce-platform/common';

/**
 * Value object for a monetary amount, stored as integer cents to avoid
 * floating-point rounding issues - same convention used throughout the
 * contracts lib (e.g. OrderCreated's unitPriceCents).
 */
export class Money {
  private constructor(
    private readonly amountCents: number,
    private readonly currency: string
  ) {}

  static create(amountCents: number, currency: string): Money {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new ValidationException('Amount must be a non-negative integer number of cents', {
        amountCents,
      });
    }
    if (currency.length !== 3) {
      throw new ValidationException('Currency must be a 3-letter ISO 4217 code', { currency });
    }

    return new Money(amountCents, currency.toUpperCase());
  }

  toCents(): number {
    return this.amountCents;
  }

  getCurrency(): string {
    return this.currency;
  }

  equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }
}
