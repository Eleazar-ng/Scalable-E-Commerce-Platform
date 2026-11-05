import { OutboxRow } from '@ecommerce-platform/common';

/**
 * Port the generic OutboxPublisherService depends on - deliberately NOT
 * Prisma-specific, so this lib has no dependency on any particular
 * service's generated Prisma client. Each service provides its own
 * adapter (e.g. PrismaOutboxStore) satisfying this interface.
 */
export interface OutboxStore {
  /**
   * Atomically claims up to `limit` PENDING rows for this publisher
   * instance and marks them PUBLISHING, then returns them. Implementers
   * should do this as SELECT ... FOR UPDATE SKIP LOCKED followed by an
   * UPDATE, both inside one short transaction - the row lock is released
   * as soon as this resolves, specifically so the caller can process rows
   * (including the slow Kafka network call) WITHOUT holding a DB
   * transaction open. SKIP LOCKED is what makes this safe to run from
   * multiple instances of the same service concurrently - each claims a
   * disjoint set of rows, none block on a row another instance is
   * already claiming.
   */
  claimBatch(limit: number): Promise<OutboxRow[]>;

  /** Successfully published - terminal state. */
  markPublished(id: string): Promise<void>;

  /** Transient failure (e.g. Kafka unreachable) - increments retryCount, reverts to PENDING for the next poll. */
  markRetry(id: string): Promise<void>;

  /** Permanent failure (retry cap exceeded, or the row itself is malformed) - terminal state, not retried again automatically. */
  markFailed(id: string): Promise<void>;
}

export const OUTBOX_STORE = Symbol('OUTBOX_STORE');
