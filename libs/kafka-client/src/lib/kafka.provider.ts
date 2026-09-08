import { Provider } from '@nestjs/common';
import { Kafka } from 'kafkajs';
import { KAFKA_CLIENT_OPTIONS, KafkaClientOptions } from './kafka-client.options';

export const KAFKA_INSTANCE = Symbol('KAFKA_INSTANCE');

/**
 * Single shared KafkaJS `Kafka` client instance per service, constructed
 * from the module's options. Both the producer and consumer adapters build
 * their respective producer()/consumer() off of this one instance.
 */
export const kafkaInstanceProvider: Provider = {
  provide: KAFKA_INSTANCE,
  useFactory: (options: KafkaClientOptions) =>
    new Kafka({ clientId: options.clientId, brokers: options.brokers }),
  inject: [KAFKA_CLIENT_OPTIONS],
};
