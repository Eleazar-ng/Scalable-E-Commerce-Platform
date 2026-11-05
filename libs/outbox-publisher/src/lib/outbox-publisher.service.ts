import { randomUUID } from 'crypto';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { GracefulShutdownService, OutboxRow } from '@ecommerce-platform/common';
import { EventEnvelope, EventTypeValue, eventSchemaRegistry } from '@ecommerce-platform/contracts';
import { KafkaProducerAdapter } from '@ecommerce-platform/kafka-client';
import { OUTBOX_STORE, OutboxStore } from './outbox-store.port';
import { OUTBOX_PUBLISHER_OPTIONS, OutboxPublisherOptions } from './outbox-publisher.options';

/**
 * Generic, service-agnostic outbox polling publisher (architecture
 * decision: Stage 3.2 - "built once, reused per service"). A service
 * wires this in by providing an OutboxStore implementation (its own
 * Prisma-backed adapter) and injecting this class as a provider alongside
 * its existing KafkaClientModule import - see product-catalog-service's
 * infrastructure module for the reference wiring.
 *
 * Failure handling (Stage 3.2 planning decision - simple retry cap, not
 * exponential backoff yet): a row that fails validation (unknown
 * eventType, malformed payload, no topic configured for its
 * aggregateType) is marked FAILED immediately - retrying won't fix bad
 * data. A row that fails to publish (Kafka unreachable) increments
 * retryCount and reverts to PENDING for the next poll, up to
 * options.maxRetries, after which it's marked FAILED too.
 */
@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private polling = false;

  constructor(
    @Inject(OUTBOX_STORE) private readonly store: OutboxStore,
    private readonly kafkaProducer: KafkaProducerAdapter,
    @Inject(OUTBOX_PUBLISHER_OPTIONS) private readonly options: OutboxPublisherOptions,
    private readonly shutdown: GracefulShutdownService
  ) {}

  onModuleInit(): void {
    this.intervalHandle = setInterval(() => {
      this.poll().catch((error) => {
        this.logger.error(`Unhandled error during outbox poll: ${(error as Error).message}`);
      });
    }, this.options.pollIntervalMs);

    this.shutdown.registerHook('outbox-publisher-stop', () => {
      this.stop();
    });

    this.logger.log(
      `Outbox publisher started (interval=${this.options.pollIntervalMs}ms, batchSize=${this.options.batchSize})`
    );
  }

  onModuleDestroy(): void {
    this.stop();
  }

  private stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  /**
   * One poll cycle: claim a batch, publish each row. Guarded against
   * overlap - if a previous poll is still running (e.g. Kafka is slow)
   * when the next interval fires, that tick is skipped rather than
   * running two polls concurrently.
   */
  async poll(): Promise<void> {
    if (this.polling) {
      return;
    }
    this.polling = true;

    try {
      const batch = await this.store.claimBatch(this.options.batchSize);
      for (const row of batch) {
        await this.publishRow(row);
      }
    } catch (error) {
      this.logger.error(`Failed to claim outbox batch: ${(error as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private async publishRow(row: OutboxRow): Promise<void> {
    const topic = this.options.topicByAggregateType[row.aggregateType];
    if (!topic) {
      this.logger.error(
        `No topic configured for aggregateType "${row.aggregateType}" (outbox row ${row.id}) - marking FAILED, this is a configuration bug`
      );
      await this.store.markFailed(row.id);
      return;
    }

    const schema = eventSchemaRegistry[row.eventType as EventTypeValue];
    if (!schema) {
      this.logger.error(
        `Unknown eventType "${row.eventType}" (outbox row ${row.id}) - marking FAILED`
      );
      await this.store.markFailed(row.id);
      return;
    }

    let validatedPayload: unknown;
    try {
      validatedPayload = schema.parse(row.payload);
    } catch (error) {
      this.logger.error(
        `Payload validation failed for outbox row ${row.id} (eventType=${row.eventType}): ${(error as Error).message} - marking FAILED`
      );
      await this.store.markFailed(row.id);
      return;
    }

    const envelope: EventEnvelope = {
      eventId: randomUUID(),
      eventType: row.eventType,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      correlationId: row.correlationId,
      occurredAt: new Date().toISOString(),
      version: 1,
      payload: validatedPayload,
    };

    try {
      await this.kafkaProducer.publish(topic, envelope);
      await this.store.markPublished(row.id);
    } catch (error) {
      const nextRetryCount = row.retryCount + 1;
      this.logger.warn(
        `Publish failed for outbox row ${row.id} (attempt ${nextRetryCount}/${this.options.maxRetries}): ${(error as Error).message}`
      );

      if (nextRetryCount >= this.options.maxRetries) {
        this.logger.error(`Outbox row ${row.id} exceeded max retries - marking FAILED`);
        await this.store.markFailed(row.id);
      } else {
        await this.store.markRetry(row.id);
      }
    }
  }
}
