/**
 * Internal domain events raised by the Reservation aggregate. Kept
 * separate from the contracts-lib Kafka event types, same pattern as
 * User Service's UserDomainEvent - the application layer (Stage 3.3
 * use-cases) translates these into InventoryReserved /
 * InventoryReservationReleased contract events.
 *
 * Note there is no "ReservationFailed" domain event here: a failed
 * reservation attempt never produces a persisted Reservation aggregate in
 * the first place (if any line's stock check fails, nothing is created),
 * so InventoryReservationFailed is raised directly by the use-case rather
 * than originating from an aggregate.
 */
export type ReservationDomainEvent =
  | {
      type: 'ReservationCreated';
      reservationId: string;
      orderId: string;
      lines: Array<{ productId: string; quantity: number }>;
    }
  | {
      type: 'ReservationReleased';
      reservationId: string;
      orderId: string;
    };
