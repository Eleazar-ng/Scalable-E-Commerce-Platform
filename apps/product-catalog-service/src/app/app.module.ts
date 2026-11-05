import { Module } from '@nestjs/common';
import { GracefulShutdownModule } from '@ecommerce-platform/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductCatalogInfrastructureModule } from '../infrastructure/product-catalog-infrastructure.module';

@Module({
  imports: [
    GracefulShutdownModule.forRoot({ serviceName: 'product-catalog-service' }),
    ProductCatalogInfrastructureModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
