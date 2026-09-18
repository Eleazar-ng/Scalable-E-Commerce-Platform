import { Reservation } from './reservation.aggregate';
import { ReservationLine } from './value-objects/reservation-line.vo';
import { EmptyReservationException, ReservationNotPendingException } from './reservation.errors';

function buildLines(): ReservationLine[] {
  return [ReservationLine.create('product-1', 2), ReservationLine.create('product-2', 1)];
}

function future(ms = 15 * 60 * 1000): Date {
  return new Date(Date.now() + ms);
}

describe('Reservation.create', () => {
  it('creates a PENDING reservation with the given lines', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    expect(reservation.status).toBe('PENDING');
    expect(reservation.lines).toHaveLength(2);
    expect(reservation.orderId).toBe('order-1');
  });

  it('rejects an empty line list', () => {
    expect(() =>
      Reservation.create({ orderId: 'order-1', lines: [], expiresAt: future() })
    ).toThrow(EmptyReservationException);
  });

  it('raises a ReservationCreated domain event with all lines', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    const events = reservation.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'ReservationCreated',
      orderId: 'order-1',
      lines: [
        { productId: 'product-1', quantity: 2 },
        { productId: 'product-2', quantity: 1 },
      ],
    });
  });

  it('clears domain events after they are pulled', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.pullDomainEvents();
    expect(reservation.pullDomainEvents()).toHaveLength(0);
  });
});

describe('Reservation.release', () => {
  it('transitions PENDING -> RELEASED', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.pullDomainEvents(); // clear creation event
    reservation.release();
    expect(reservation.status).toBe('RELEASED');
  });

  it('raises a ReservationReleased domain event', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.pullDomainEvents();
    reservation.release();

    const events = reservation.pullDomainEvents();
    expect(events).toEqual([
      { type: 'ReservationReleased', reservationId: reservation.id, orderId: 'order-1' },
    ]);
  });

  it('throws if not PENDING', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.release();
    expect(() => reservation.release()).toThrow(ReservationNotPendingException);
  });
});

describe('Reservation.confirm', () => {
  it('transitions PENDING -> CONFIRMED', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.confirm();
    expect(reservation.status).toBe('CONFIRMED');
  });

  it('does not raise any domain event (bookkeeping only, no further stock movement)', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.pullDomainEvents();
    reservation.confirm();
    expect(reservation.pullDomainEvents()).toHaveLength(0);
  });

  it('throws if not PENDING', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.confirm();
    expect(() => reservation.confirm()).toThrow(ReservationNotPendingException);
  });
});

describe('Reservation.expire', () => {
  it('transitions PENDING -> EXPIRED', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.expire();
    expect(reservation.status).toBe('EXPIRED');
  });

  it('throws if not PENDING', () => {
    const reservation = Reservation.create({ orderId: 'order-1', lines: buildLines(), expiresAt: future() });
    reservation.release();
    expect(() => reservation.expire()).toThrow(ReservationNotPendingException);
  });
});

describe('Reservation.reconstitute', () => {
  it('rehydrates from persisted props without raising domain events', () => {
    const now = new Date();
    const reservation = Reservation.reconstitute({
      id: 'res-1',
      orderId: 'order-1',
      lines: buildLines(),
      status: 'CONFIRMED',
      expiresAt: future(),
      createdAt: now,
      updatedAt: now,
    });

    expect(reservation.id).toBe('res-1');
    expect(reservation.status).toBe('CONFIRMED');
    expect(reservation.pullDomainEvents()).toHaveLength(0);
  });
});
