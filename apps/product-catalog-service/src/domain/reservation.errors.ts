import { DomainException, ValidationException } from '@ecommerce-platform/common';

export class EmptyReservationException extends ValidationException {
  constructor() {
    super('A reservation must contain at least one line item');
  }
}

export class ReservationNotPendingException extends DomainException {
  constructor(reservationId: string, currentStatus: string) {
    super(`Reservation is not in a PENDING state (currently ${currentStatus})`, {
      reservationId,
      currentStatus,
    });
  }
}
