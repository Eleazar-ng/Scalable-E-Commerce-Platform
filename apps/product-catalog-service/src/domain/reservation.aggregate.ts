import { randomUUID } from 'crypto';
import { ReservationLine } from './value-objects/reservation-line.vo';
import { ReservationDomainEvent } from './reservation-domain-event';
import { EmptyReservationException, ReservationNotPendingException } from './reservation.errors';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED' | 'EXPIRED';

export interface ReservationProps {
  id: string;
  orderId: string;
  lines: ReservationLine[];
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Order-level reservation, bridging a multi-product order against several
 * per-product Inventory aggregates (architecture decision: Stage 3.1
 * planning). The use-case that creates this (Stage 3.3) is responsible for
 * having already successfully called reserve() on every affected
 * Inventory aggregate, inside the same database transaction as this
 * aggregate's insert - Reservation itself does not talk to Inventory.
 */
export class Reservation {
  private readonly domainEvents: ReservationDomainEvent[] = [];

  private constructor(private props: ReservationProps) {}

  static create(params: {
    orderId: string;
    lines: ReservationLine[];
    expiresAt: Date;
  }): Reservation {
    if (params.lines.length === 0) {
      throw new EmptyReservationException();
    }

    const now = new Date();
    const reservation = new Reservation({
      id: randomUUID(),
      orderId: params.orderId,
      lines: params.lines,
      status: 'PENDING',
      expiresAt: params.expiresAt,
      createdAt: now,
      updatedAt: now,
    });

    reservation.domainEvents.push({
      type: 'ReservationCreated',
      reservationId: reservation.props.id,
      orderId: reservation.props.orderId,
      lines: params.lines.map((line) => ({
        productId: line.getProductId(),
        quantity: line.getQuantity(),
      })),
    });

    return reservation;
  }

  static reconstitute(props: ReservationProps): Reservation {
    return new Reservation(props);
  }

  /**
   * Compensating action - the use-case is responsible for calling
   * release() on every affected Inventory aggregate in the same
   * transaction as this state change.
   */
  release(): void {
    this.assertPending();
    this.props.status = 'RELEASED';
    this.props.updatedAt = new Date();

    this.domainEvents.push({
      type: 'ReservationReleased',
      reservationId: this.props.id,
      orderId: this.props.orderId,
    });
  }

  /**
   * Bookkeeping only - the stock was already permanently deducted at
   * reserve() time (the optimistic reservation model), so confirm() does
   * not move any further stock. Called when the order is confirmed.
   */
  confirm(): void {
    this.assertPending();
    this.props.status = 'CONFIRMED';
    this.props.updatedAt = new Date();
  }

  /** Used by the future expiry-sweep worker (Stage 5.4/8) - not yet wired up. */
  expire(): void {
    this.assertPending();
    this.props.status = 'EXPIRED';
    this.props.updatedAt = new Date();
  }

  private assertPending(): void {
    if (this.props.status !== 'PENDING') {
      throw new ReservationNotPendingException(this.props.id, this.props.status);
    }
  }

  pullDomainEvents(): ReservationDomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents.length = 0;
    return events;
  }

  get id(): string {
    return this.props.id;
  }

  get orderId(): string {
    return this.props.orderId;
  }

  get lines(): ReservationLine[] {
    return [...this.props.lines];
  }

  get status(): ReservationStatus {
    return this.props.status;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toSnapshot(): ReservationProps {
    return { ...this.props, lines: [...this.props.lines] };
  }
}
