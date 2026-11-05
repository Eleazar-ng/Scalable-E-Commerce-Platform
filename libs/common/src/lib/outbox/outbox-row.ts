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
  /**
   * Claimed by a publisher instance (via SELECT ... FOR UPDATE SKIP
   * LOCKED, then immediately marked PUBLISHING in the same short
   * transaction before the row lock is released) but not yet confirmed
   * sent to Kafka. This intermediate status is what lets the publisher
   * release the DB row lock BEFORE making the slow network call to
   * Kafka, rather than holding a transaction open for the duration of
   * that call - holding a DB transaction open across network I/O is an
   * anti-pattern (ties up a pool connection, risks transaction timeouts).
   * A row stuck in PUBLISHING past a reasonable window (its publisher
   * crashed mid-send) is a case the future expiry/recovery sweep would
   * also need to handle - not yet built, same as Inventory reservation
   * expiry.
   */
  PUBLISHING = 'PUBLISHING',
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
  /**
   * Ties every event in one saga/request flow together (mirrors the
   * `contracts` lib's envelope.correlationId - see EventEnvelope). Must be
   * threaded through from whatever triggered this write, not generated
   * fresh at publish time, or cross-service saga tracing breaks. For an
   * event that isn't part of a saga (e.g. User Service's UserRegistered),
   * a freshly generated id here is fine since there's nothing to
   * correlate it with.
   */
  correlationId: string;
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
  'aggregateType' | 'aggregateId' | 'eventType' | 'correlationId' | 'payload'
>;
