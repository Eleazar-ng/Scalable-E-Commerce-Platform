import { Injectable, Logger } from '@nestjs/common';
import { ExternalServiceException, OutboxRow, OutboxStatus } from '@ecommerce-platform/common';
import { OutboxStore } from '@ecommerce-platform/outbox-publisher';
import { PrismaService } from './prisma.service';

/** See product-catalog-service's PrismaOutboxStore for the full explanation of this shape and the raw-SQL verification caveat - identical implementation, just User Service's own PrismaService. */
interface OutboxRowDb {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  correlationId: string;
  payload: unknown;
  status: string;
  createdAt: Date;
  publishedAt: Date | null;
  retryCount: number;
}

@Injectable()
export class PrismaOutboxStore implements OutboxStore {
  private readonly logger = new Logger(PrismaOutboxStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async claimBatch(limit: number): Promise<OutboxRow[]> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<OutboxRowDb[]>`
          SELECT id, "aggregateType", "aggregateId", "eventType", "correlationId",
                 payload, status, "createdAt", "publishedAt", "retryCount"
          FROM outbox
          WHERE status = 'PENDING'
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        `;

        if (rows.length > 0) {
          const ids = rows.map((row) => row.id);
          await tx.$executeRaw`UPDATE outbox SET status = 'PUBLISHING' WHERE id = ANY(${ids})`;
        }

        return rows.map((row) => ({
          id: row.id,
          aggregateType: row.aggregateType,
          aggregateId: row.aggregateId,
          eventType: row.eventType,
          correlationId: row.correlationId,
          payload: row.payload as Record<string, unknown>,
          status: OutboxStatus.PUBLISHING,
          createdAt: row.createdAt,
          publishedAt: row.publishedAt,
          retryCount: row.retryCount,
        }));
      });
    } catch (error) {
      throw new ExternalServiceException('Outbox store claimBatch failed', {
        retryable: true,
        cause: error,
      });
    }
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  async markRetry(id: string): Promise<void> {
    await this.prisma.outbox.update({
      where: { id },
      data: { status: 'PENDING', retryCount: { increment: 1 } },
    });
  }

  async markFailed(id: string): Promise<void> {
    this.logger.warn(`Outbox row ${id} marked FAILED - will not be retried automatically`);
    await this.prisma.outbox.update({
      where: { id },
      data: { status: 'FAILED' },
    });
  }
}
