/**
 * Shared shape for a Transactional Outbox row. Each service defines its own
 * Prisma model for its `outbox` table (own migration, own DB, per the
 * database-per-service decision) - this type exists so the polling
 * publisher logic (built once, reused per service) can be written against a
 * single consistent interface regardless of which service's Prisma client
 * produced the row.
 *
 * Each service's Prisma `Outbox` model should structurally match this
 * shape (field names and types), even though it's a separate generated
 * Prisma Client type per service.
 */
export enum OutboxStatus {
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export interface OutboxRow {
  id: string;
  /** The aggregate type this event concerns, e.g. "Order", "PaymentIntent" */
  aggregateType: string;
  /** The aggregate's id, e.g. the order id */
  aggregateId: string;
  /** The Kafka event type, matching a schema in the `contracts` lib, e.g. "OrderCreated" */
  eventType: string;
  /** JSON-serializable event payload, validated against its Zod schema before insert */
  payload: Record<string, unknown>;
  status: OutboxStatus;
  createdAt: Date;
  publishedAt: Date | null;
  retryCount: number;
}

/**
 * Fields a service provides when inserting a new outbox row inside the same
 * DB transaction as its domain write (the core of the outbox pattern -
 * solving the dual-write problem by writing both in one transaction).
 */
export type NewOutboxRow = Pick<
  OutboxRow,
  'aggregateType' | 'aggregateId' | 'eventType' | 'payload'
>;
