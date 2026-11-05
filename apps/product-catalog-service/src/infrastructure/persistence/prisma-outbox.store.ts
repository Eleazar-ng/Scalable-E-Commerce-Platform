import { Injectable, Logger } from '@nestjs/common';
import { ExternalServiceException, OutboxRow, OutboxStatus } from '@ecommerce-platform/common';
import { OutboxStore } from '@ecommerce-platform/outbox-publisher';
import { PrismaService } from './prisma.service';

/**
 * Shape returned by the raw SQL queries below - matches the Outbox
 * model's column names exactly (Prisma migrations quote camelCase
 * identifiers, so Postgres preserves this exact casing; the raw SQL here
 * must double-quote every camelCase column name for the same reason,
 * `outbox` and `status`/`payload`/`id` don't need quoting since they're
 * already lowercase).
 */
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

/**
 * NOTE ON VERIFICATION: this is the one piece of this entire Prisma
 * integration that involves genuinely hand-written raw SQL (everything
 * else uses Prisma's query builder, which is far more likely to be
 * correct even unverified). Unlike the routine "prisma generate could not
 * run in this sandbox" limitation that applies to every service's
 * Prisma-backed code, this file's claimBatch() query has NOT been run
 * against a real Postgres instance at all - please test this specifically
 * (not just `prisma generate`/build) before trusting it in a demo.
 */
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
          status: OutboxStatus.PUBLISHING, // already updated above, within the same transaction
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
