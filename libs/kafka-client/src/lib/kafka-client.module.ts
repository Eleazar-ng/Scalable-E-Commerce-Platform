import { DynamicModule, Module } from '@nestjs/common';
import { KAFKA_CLIENT_OPTIONS, KafkaClientOptions } from './kafka-client.options';
import { kafkaInstanceProvider } from './kafka.provider';
import { KafkaProducerAdapter } from './kafka-producer.adapter';
import { KafkaConsumerAdapter } from './kafka-consumer.adapter';

/**
 * Import in a service's AppModule:
 *
 *   KafkaClientModule.forRoot({
 *     clientId: 'payment-service',
 *     brokers: [process.env.KAFKA_BROKERS ?? 'localhost:9092'],
 *     consumerGroupId: 'payment-service-group', // omit if this service only produces
 *   })
 *
 * Requires GracefulShutdownModule.forRoot(...) to also be imported (it's
 * @Global(), so importing it once anywhere in the app is enough) - both
 * adapters register their disconnect logic as shutdown hooks rather than
 * managing their own signal handling.
 */
@Module({})
export class KafkaClientModule {
  static forRoot(options: KafkaClientOptions): DynamicModule {
    return {
      module: KafkaClientModule,
      providers: [
        { provide: KAFKA_CLIENT_OPTIONS, useValue: options },
        kafkaInstanceProvider,
        KafkaProducerAdapter,
        KafkaConsumerAdapter,
      ],
      exports: [KafkaProducerAdapter, KafkaConsumerAdapter],
    };
  }
}
