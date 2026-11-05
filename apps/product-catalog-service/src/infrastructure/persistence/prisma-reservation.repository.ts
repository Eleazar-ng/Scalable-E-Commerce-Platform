import { Injectable } from '@nestjs/common';
import { ExternalServiceException, NewOutboxRow } from '@ecommerce-platform/common';
import { Reservation } from '../../domain/reservation.aggregate';
import { Inventory } from '../../domain/inventory.aggregate';
import { InventoryConcurrencyConflictException } from '../../domain/inventory.errors';
import { ReservationRepositoryPort } from '../../application/ports/reservation-repository.port';
import { PrismaService } from './prisma.service';
import { ReservationMapper } from './reservation.mapper';
import { InventoryMapper } from './inventory.mapper';

/**
 * The two methods here are the only genuinely cross-aggregate transactions
 * in this service (see ReservationRepositoryPort's doc comment). Both use
 * Prisma's INTERACTIVE transaction form (a callback receiving `tx`), not
 * the array form, because the Inventory optimistic-concurrency check
 * needs to inspect each updateMany()'s row count and abort the whole
 * transaction immediately on a conflict - the array form submits every
 * operation upfront and can't branch on an intermediate result.
 */
@Injectable()
export class PrismaReservationRepository implements ReservationRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createReservationWithInventoryUpdates(params: {
    reservation: Reservation;
    updatedInventories: Inventory[];
    outboxEvents: NewOutboxRow[];
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.applyInventoryUpdates(tx, params.updatedInventories);

        const reservationRow = ReservationMapper.toPersistence(params.reservation);
        await tx.reservation.create({ data: reservationRow });

        const lines = ReservationMapper.linesToPersistence(params.reservation);
        await tx.reservationLine.createMany({
          data: lines.map((line) => ({ reservationId: params.reservation.id, ...line })),
        });

        await this.createOutboxEvents(tx, params.outboxEvents);
      });
    } catch (error) {
      throw this.wrapError('createReservationWithInventoryUpdates', params.reservation.id, error);
    }
  }

  async releaseReservationWithInventoryUpdates(params: {
    reservation: Reservation;
    updatedInventories: Inventory[];
    outboxEvents: NewOutboxRow[];
  }): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.applyInventoryUpdates(tx, params.updatedInventories);

        const reservationRow = ReservationMapper.toPersistence(params.reservation);
        await tx.reservation.update({
          where: { id: reservationRow.id },
          data: { status: reservationRow.status, updatedAt: reservationRow.updatedAt },
        });

        await this.createOutboxEvents(tx, params.outboxEvents);
      });
    } catch (error) {
      throw this.wrapError('releaseReservationWithInventoryUpdates', params.reservation.id, error);
    }
  }

  async findById(reservationId: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { lines: true },
    });
    return row ? ReservationMapper.toDomain(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Reservation | null> {
    const row = await this.prisma.reservation.findFirst({
      where: { orderId },
      include: { lines: true },
    });
    return row ? ReservationMapper.toDomain(row) : null;
  }

  /**
   * Shared by both transactional methods: applies every Inventory update
   * inside the given transaction, enforcing optimistic concurrency on
   * each one (same convention as PrismaInventoryRepository.update - see
   * its comment). Throws immediately on the first conflict, which aborts
   * the whole transaction (nothing partially commits).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async applyInventoryUpdates(tx: any, inventories: Inventory[]): Promise<void> {
    for (const inventory of inventories) {
      const row = InventoryMapper.toPersistence(inventory);
      const previousVersion = row.version - 1;

      const result = await tx.inventory.updateMany({
        where: { id: row.id, version: previousVersion },
        data: {
          availableQuantity: row.availableQuantity,
          reservedQuantity: row.reservedQuantity,
          version: row.version,
          updatedAt: row.updatedAt,
        },
      });

      if (result.count === 0) {
        throw new InventoryConcurrencyConflictException(inventory.productId);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async createOutboxEvents(tx: any, events: NewOutboxRow[]): Promise<void> {
    for (const event of events) {
      await tx.outbox.create({
        data: {
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventType: event.eventType,
          correlationId: event.correlationId,
          payload: event.payload as object,
        },
      });
    }
  }

  private wrapError(
    operation: string,
    reservationId: string,
    error: unknown
  ): InventoryConcurrencyConflictException | ExternalServiceException {
    // A concurrency conflict is domain-meaningful - propagate as-is rather
    // than wrapping it in a generic ExternalServiceException, so the
    // use-case can distinguish "retry this" from "something is broken."
    if (error instanceof InventoryConcurrencyConflictException) {
      return error;
    }
    return new ExternalServiceException(`Reservation repository ${operation} failed`, {
      retryable: true,
      context: { operation, reservationId },
      cause: error,
    });
  }
}
