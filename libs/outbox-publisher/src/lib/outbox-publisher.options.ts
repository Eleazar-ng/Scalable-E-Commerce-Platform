import { KafkaTopic } from '@ecommerce-platform/contracts';

export const OUTBOX_PUBLISHER_OPTIONS = Symbol('OUTBOX_PUBLISHER_OPTIONS');

export interface OutboxPublisherOptions {
  /** How often to poll for pending rows. Default: 3000 (3s) if not set by the consuming service. */
  pollIntervalMs: number;
  /** Max rows claimed per poll cycle. Default: 50. */
  batchSize: number;
  /**
   * A publish failure increments retryCount; once retryCount reaches this
   * cap, the row is marked FAILED instead of retried again (Stage 3.2
   * planning decision: simple retry cap, not exponential backoff - the
   * poll interval itself is the retry cadence).
   */
  maxRetries: number;
  /**
   * Maps each aggregateType this service's outbox ever contains to the
   * Kafka topic it publishes to (topic-per-aggregate strategy). A row
   * whose aggregateType has no entry here is marked FAILED immediately -
   * that's a configuration bug, not a transient failure, so it's never
   * worth retrying.
   */
  topicByAggregateType: Record<string, KafkaTopic>;
}
