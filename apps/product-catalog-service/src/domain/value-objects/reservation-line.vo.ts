import { ValidationException } from '@ecommerce-platform/common';

/**
 * One line item within a Reservation - a product + quantity pair. A value
 * object (immutable, no identity of its own), owned by the Reservation
 * aggregate rather than persisted/loaded independently.
 */
export class ReservationLine {
  private constructor(
    private readonly productId: string,
    private readonly quantity: number
  ) {}

  static create(productId: string, quantity: number): ReservationLine {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationException('Reservation line quantity must be a positive integer', {
        productId,
        quantity,
      });
    }
    return new ReservationLine(productId, quantity);
  }

  getProductId(): string {
    return this.productId;
  }

  getQuantity(): number {
    return this.quantity;
  }
}
