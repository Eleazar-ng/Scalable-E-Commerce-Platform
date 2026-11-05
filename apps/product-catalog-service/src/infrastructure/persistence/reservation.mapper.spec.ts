import { Reservation } from '../../domain/reservation.aggregate';
import { ReservationLine } from '../../domain/value-objects/reservation-line.vo';
import { ReservationMapper, ReservationRow } from './reservation.mapper';

describe('ReservationMapper', () => {
  it('round-trips through toPersistence + linesToPersistence -> toDomain', () => {
    const original = Reservation.create({
      orderId: 'order-1',
      lines: [ReservationLine.create('product-1', 2), ReservationLine.create('product-2', 1)],
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const row: ReservationRow = {
      ...ReservationMapper.toPersistence(original),
      lines: ReservationMapper.linesToPersistence(original),
    };
    const rehydrated = ReservationMapper.toDomain(row);

    expect(rehydrated.id).toBe(original.id);
    expect(rehydrated.orderId).toBe('order-1');
    expect(rehydrated.lines).toHaveLength(2);
    expect(rehydrated.lines[0].getProductId()).toBe('product-1');
    expect(rehydrated.lines[0].getQuantity()).toBe(2);
  });

  it('does not raise domain events when reconstituting', () => {
    const original = Reservation.create({
      orderId: 'order-1',
      lines: [ReservationLine.create('product-1', 1)],
      expiresAt: new Date(Date.now() + 1000),
    });
    original.pullDomainEvents();

    const row: ReservationRow = {
      ...ReservationMapper.toPersistence(original),
      lines: ReservationMapper.linesToPersistence(original),
    };
    const rehydrated = ReservationMapper.toDomain(row);
    expect(rehydrated.pullDomainEvents()).toHaveLength(0);
  });
});
