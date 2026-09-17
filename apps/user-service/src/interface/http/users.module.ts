import { Module } from '@nestjs/common';
import { UserInfrastructureModule } from '../../infrastructure/user-infrastructure.module';
import { UsersController } from './users.controller';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { DeleteAccountUseCase } from '../../application/use-cases/delete-account.use-case';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [UserInfrastructureModule],
  controllers: [UsersController],
  providers: [
    RegisterUserUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    GetProfileUseCase,
    UpdateProfileUseCase,
    DeleteAccountUseCase,
    JwtAuthGuard,
  ],
})
export class UsersModule {}
