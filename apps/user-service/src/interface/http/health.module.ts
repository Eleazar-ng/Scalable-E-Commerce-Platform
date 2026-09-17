import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { UserInfrastructureModule } from '../../infrastructure/user-infrastructure.module';
import { HealthController } from './health.controller';

@Module({
  imports: [TerminusModule, UserInfrastructureModule],
  controllers: [HealthController],
})
export class HealthModule {}
