import { ValidationException } from '@ecommerce-platform/common';

// Alphanumeric plus hyphens, e.g. "TSHIRT-BLU-M". Deliberately permissive -
// this project doesn't enforce a specific SKU scheme, just a sane charset
// and non-empty length.
const SKU_PATTERN = /^[A-Z0-9-]+$/;

export class Sku {
  private constructor(private readonly value: string) {}

  static create(rawSku: string): Sku {
    const normalized = rawSku.trim().toUpperCase();

    if (normalized.length === 0) {
      throw new ValidationException('SKU cannot be empty');
    }
    if (!SKU_PATTERN.test(normalized)) {
      throw new ValidationException('SKU must contain only letters, numbers, and hyphens', {
        sku: rawSku,
      });
    }

    return new Sku(normalized);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Sku): boolean {
    return this.value === other.value;
  }
}
