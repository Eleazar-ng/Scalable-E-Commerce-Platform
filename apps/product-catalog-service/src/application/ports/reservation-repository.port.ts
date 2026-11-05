import { NewOutboxRow } from '@ecommerce-platform/common';
import { Reservation } from '../../domain/reservation.aggregate';
import { Inventory } from '../../domain/inventory.aggregate';

/**
 * Owns the two genuinely cross-aggregate transactions in this service:
 * creating (or releasing) an order-level Reservation always means writing
 * several Inventory rows AND the Reservation(+lines) row AND an outbox
 * event together, atomically. Rather than introducing a generic
 * Unit-of-Work abstraction, this follows the same pattern already
 * established by User Service's createWithOutboxEvents - one repository
 * method per whole-transaction operation, composing everything that
 * transaction needs as parameters.
 *
 * Both methods expect the aggregates passed in to already reflect their
 * POST-mutation state (i.e. the use-case already called reserve()/
 * release() on each Inventory and Reservation.create()/release() before
 * calling this) - persistence only, no domain logic here.
 */
export interface ReservationRepositoryPort {
  createReservationWithInventoryUpdates(params: {
    reservation: Reservation;
    updatedInventories: Inventory[];
    outboxEvents: NewOutboxRow[];
  }): Promise<void>;

  releaseReservationWithInventoryUpdates(params: {
    reservation: Reservation;
    updatedInventories: Inventory[];
    outboxEvents: NewOutboxRow[];
  }): Promise<void>;

  findById(reservationId: string): Promise<Reservation | null>;
  findByOrderId(orderId: string): Promise<Reservation | null>;
}

export const RESERVATION_REPOSITORY = Symbol('RESERVATION_REPOSITORY');
