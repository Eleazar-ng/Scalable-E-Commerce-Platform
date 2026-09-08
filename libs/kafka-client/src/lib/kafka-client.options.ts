export const KAFKA_CLIENT_OPTIONS = Symbol('KAFKA_CLIENT_OPTIONS');

export interface KafkaClientOptions {
  /** Identifies this service to the Kafka cluster, e.g. "payment-service" */
  clientId: string;
  /** Broker addresses, e.g. ["localhost:9092"] */
  brokers: string[];
  /** Consumer group id - required if this service will consume, e.g. "payment-service-group" */
  consumerGroupId?: string;
}
