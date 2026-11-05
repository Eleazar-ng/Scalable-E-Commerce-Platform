import { Module } from '@nestjs/common';
import { KafkaClientModule } from '@ecommerce-platform/kafka-client';
import { KafkaTopics } from '@ecommerce-platform/contracts';
import {
  OUTBOX_PUBLISHER_OPTIONS,
  OUTBOX_STORE,
  OutboxPublisherOptions,
  OutboxPublisherService,
} from '@ecommerce-platform/outbox-publisher';
import { CATEGORY_REPOSITORY } from '../application/ports/category-repository.port';
import { PRODUCT_REPOSITORY } from '../application/ports/product-repository.port';
import { INVENTORY_REPOSITORY } from '../application/ports/inventory-repository.port';
import { RESERVATION_REPOSITORY } from '../application/ports/reservation-repository.port';
import { PrismaService } from './persistence/prisma.service';
import { PrismaCategoryRepository } from './persistence/prisma-category.repository';
import { PrismaProductRepository } from './persistence/prisma-product.repository';
import { PrismaInventoryRepository } from './persistence/prisma-inventory.repository';
import { PrismaReservationRepository } from './persistence/prisma-reservation.repository';
import { PrismaOutboxStore } from './persistence/prisma-outbox.store';

/**
 * Wires every Stage 3.1/3.2 adapter to the port it satisfies. Application
 * code (Stage 3.3 use-cases) depends only on the port tokens exported
 * here - never on the concrete Prisma-backed classes.
 *
 * Config read from env here, at the composition root - same convention as
 * UserInfrastructureModule.
 */
@Module({
  imports: [
    KafkaClientModule.forRoot({
      clientId: 'product-catalog-service',
      brokers: (process.env['KAFKA_BROKERS_HOST'] ?? 'localhost:29092').split(','),
      // No consumerGroupId yet - this service doesn't consume from Kafka
      // until Stage 3.3 wires up the OrderCreated handler that triggers
      // reservations. It only produces, via the outbox publisher below.
    }),
  ],
  providers: [
    PrismaService,
    {
      provide: OUTBOX_PUBLISHER_OPTIONS,
      useFactory: (): OutboxPublisherOptions => ({
        pollIntervalMs: Number(process.env['OUTBOX_POLL_INTERVAL_MS'] ?? 3000),
        batchSize: Number(process.env['OUTBOX_BATCH_SIZE'] ?? 50),
        maxRetries: Number(process.env['OUTBOX_MAX_RETRIES'] ?? 5),
        // This service's outbox will contain events for the Reservation
        // aggregate (InventoryReserved, InventoryReservationFailed,
        // InventoryReservationReleased - see contracts) - all on the one
        // catalog-events topic per the topic-per-aggregate strategy.
        topicByAggregateType: { Reservation: KafkaTopics.CATALOG_EVENTS },
      }),
    },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    { provide: OUTBOX_STORE, useClass: PrismaOutboxStore },
    OutboxPublisherService,
  ],
  exports: [
    CATEGORY_REPOSITORY,
    PRODUCT_REPOSITORY,
    INVENTORY_REPOSITORY,
    RESERVATION_REPOSITORY,
    PrismaService,
  ],
})
export class ProductCatalogInfrastructureModule {}
