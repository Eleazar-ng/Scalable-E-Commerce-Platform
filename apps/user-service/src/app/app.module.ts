import { Module } from '@nestjs/common';
import { GracefulShutdownModule } from '@ecommerce-platform/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserInfrastructureModule } from '../infrastructure/user-infrastructure.module';

@Module({
  imports: [
    GracefulShutdownModule.forRoot({ serviceName: 'user-service' }),
    UserInfrastructureModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
