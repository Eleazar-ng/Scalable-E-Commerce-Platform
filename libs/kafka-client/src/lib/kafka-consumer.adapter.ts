import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { GracefulShutdownService } from '@ecommerce-platform/common';
import { EventEnvelope, KafkaTopic, parseEventEnvelope } from '@ecommerce-platform/contracts';
import { KAFKA_CLIENT_OPTIONS, KafkaClientOptions } from './kafka-client.options';
import { KAFKA_INSTANCE } from './kafka.provider';

export type EventHandler = (envelope: EventEnvelope) => Promise<void>;

/**
 * Thin wrapper around a KafkaJS consumer - the adapter half of the ports &
 * adapters pattern for inbound Kafka messages.
 *
 * Every message is parsed and validated against its envelope + payload
 * schema (via `parseEventEnvelope` from the contracts lib) BEFORE the
 * handler is invoked, so handlers can trust the shape of what they receive
 * and never need to re-validate. A message that fails to parse/validate is
 * logged and NOT retried automatically here - that decision (retry vs. send
 * to DLQ) belongs to the backoff/DLQ wiring built in Stage 5.4, which wraps
 * this adapter rather than living inside it.
 */
@Injectable()
export class KafkaConsumerAdapter implements OnModuleInit {
  private readonly logger = new Logger(KafkaConsumerAdapter.name);
  private readonly kafka: Kafka;
  private consumer: Consumer | null = null;
  private readonly subscriptions = new Map<string, EventHandler>();

  constructor(
    @Inject(KAFKA_INSTANCE) kafka: Kafka,
    @Inject(KAFKA_CLIENT_OPTIONS) private readonly options: KafkaClientOptions,
    private readonly shutdown: GracefulShutdownService
  ) {
    this.kafka = kafka;
  }

  async onModuleInit(): Promise<void> {
    // Deliberately lazy: a service that only produces (no consumerGroupId
    // configured) should never pay the cost of connecting a consumer it
    // will never use. The consumer is created and connected on first
    // subscribe() call instead.
  }

  /**
   * Registers a handler for a topic and starts consuming, if not already
   * running. Call once per topic during each service's bootstrap.
   */
  async subscribe(topic: KafkaTopic, handler: EventHandler): Promise<void> {
    if (!this.options.consumerGroupId) {
      throw new Error('KafkaClientOptions.consumerGroupId is required to consume messages');
    }

    const isFirstSubscription = !this.consumer;

    if (!this.consumer) {
      this.consumer = this.kafka.consumer({ groupId: this.options.consumerGroupId });
      await this.consumer.connect();
      this.logger.log(
        `Consumer connected (clientId=${this.options.clientId}, groupId=${this.options.consumerGroupId})`
      );
      this.shutdown.registerHook('kafka-consumer', () => this.consumer?.disconnect());
    }

    this.subscriptions.set(topic, handler);
    await this.consumer.subscribe({ topic, fromBeginning: false });

    if (isFirstSubscription) {
      await this.consumer.run({ eachMessage: (payload) => this.handleMessage(payload) });
    }
  }

  private async handleMessage({ topic, message }: EachMessagePayload): Promise<void> {
    const handler = this.subscriptions.get(topic);
    if (!handler) {
      this.logger.warn(`No handler registered for topic "${topic}" - message skipped`);
      return;
    }

    let envelope: EventEnvelope;
    try {
      const raw = JSON.parse(message.value?.toString() ?? '{}');
      envelope = parseEventEnvelope(raw);
    } catch (error) {
      this.logger.error(
        `Malformed message on topic "${topic}" - failed envelope/schema validation: ${(error as Error).message}`
      );
      return;
    }

    try {
      await handler(envelope);
    } catch (error) {
      // Intentionally not re-thrown: this adapter has no opinion on retry
      // policy. Handlers that need retry/backoff/DLQ behavior should be
      // wrapped with that logic (Stage 5.4) rather than relying on this
      // adapter to do it implicitly.
      this.logger.error(
        `Handler for "${envelope.eventType}" (topic "${topic}") threw: ${(error as Error).message}`
      );
    }
  }
}
