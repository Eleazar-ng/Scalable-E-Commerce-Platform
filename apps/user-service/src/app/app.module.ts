import { Module } from '@nestjs/common';
import { GracefulShutdownModule } from '@ecommerce-platform/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserInfrastructureModule } from '../infrastructure/user-infrastructure.module';
import { UsersModule } from '../interface/http/users.module';
import { HealthModule } from '../interface/http/health.module';

@Module({
  imports: [
    GracefulShutdownModule.forRoot({ serviceName: 'user-service' }),
    UserInfrastructureModule,
    UsersModule,
    HealthModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
