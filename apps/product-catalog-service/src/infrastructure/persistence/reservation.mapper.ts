import { Reservation, ReservationStatus } from '../../domain/reservation.aggregate';
import { ReservationLine } from '../../domain/value-objects/reservation-line.vo';

export interface ReservationLineRow {
  productId: string;
  quantity: number;
}

export interface ReservationRow {
  id: string;
  orderId: string;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  lines: ReservationLineRow[];
}

export class ReservationMapper {
  static toDomain(row: ReservationRow): Reservation {
    return Reservation.reconstitute({
      id: row.id,
      orderId: row.orderId,
      status: row.status as ReservationStatus,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lines: row.lines.map((line) => ReservationLine.create(line.productId, line.quantity)),
    });
  }

  /** Everything except `lines`, which the repository writes as child rows separately. */
  static toPersistence(reservation: Reservation): Omit<ReservationRow, 'lines'> {
    const snapshot = reservation.toSnapshot();
    return {
      id: snapshot.id,
      orderId: snapshot.orderId,
      status: snapshot.status,
      expiresAt: snapshot.expiresAt,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    };
  }

  static linesToPersistence(reservation: Reservation): ReservationLineRow[] {
    return reservation.lines.map((line) => ({
      productId: line.getProductId(),
      quantity: line.getQuantity(),
    }));
  }
}
