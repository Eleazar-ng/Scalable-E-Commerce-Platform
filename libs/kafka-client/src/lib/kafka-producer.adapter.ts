import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import { ExternalServiceException, GracefulShutdownService } from '@ecommerce-platform/common';
import { EventEnvelope, KafkaTopic } from '@ecommerce-platform/contracts';
import { KAFKA_CLIENT_OPTIONS, KafkaClientOptions } from './kafka-client.options';
import { KAFKA_INSTANCE } from './kafka.provider';

/**
 * Thin wrapper around a KafkaJS producer - the adapter half of the
 * ports & adapters pattern for outbound Kafka messages. Callers (the
 * per-service polling publisher, built in Stage 3.2) depend on this rather
 * than on KafkaJS directly, so the underlying client library stays
 * swappable.
 *
 * Partition key is always the envelope's aggregateId, per the
 * topic-per-aggregate strategy - this preserves ordering of events about
 * the same order/payment/reservation.
 */
@Injectable()
export class KafkaProducerAdapter implements OnModuleInit {
  private readonly logger = new Logger(KafkaProducerAdapter.name);
  private readonly producer: Producer;

  constructor(
    @Inject(KAFKA_INSTANCE) kafka: Kafka,
    @Inject(KAFKA_CLIENT_OPTIONS) private readonly options: KafkaClientOptions,
    private readonly shutdown: GracefulShutdownService
  ) {
    this.producer = kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log(`Producer connected (clientId=${this.options.clientId})`);
    this.shutdown.registerHook('kafka-producer', () => this.producer.disconnect());
  }

  async publish(topic: KafkaTopic, envelope: EventEnvelope): Promise<void> {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: envelope.aggregateId,
            value: JSON.stringify(envelope),
            headers: { eventType: envelope.eventType, correlationId: envelope.correlationId },
          },
        ],
      });
    } catch (error) {
      throw new ExternalServiceException(`Failed to publish ${envelope.eventType} to ${topic}`, {
        retryable: true,
        context: { topic, eventType: envelope.eventType, eventId: envelope.eventId },
        cause: error,
      });
    }
  }
}
