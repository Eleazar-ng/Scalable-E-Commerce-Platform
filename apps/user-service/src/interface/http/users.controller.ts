import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '@ecommerce-platform/common';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { GetProfileUseCase } from '../../application/use-cases/get-profile.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { DeleteAccountUseCase } from '../../application/use-cases/delete-account.use-case';
import {
  loginRequestSchema,
  LoginRequest,
  refreshRequestSchema,
  RefreshRequest,
  registerRequestSchema,
  RegisterRequest,
  updateProfileRequestSchema,
  UpdateProfileRequest,
} from './dto/requests';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AccessTokenPayload } from '../../application/ports/token-service.port';

@Controller('users')
export class UsersController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly getProfile: GetProfileUseCase,
    private readonly updateProfile: UpdateProfileUseCase,
    private readonly deleteAccount: DeleteAccountUseCase
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body(new ZodValidationPipe(registerRequestSchema)) dto: RegisterRequest) {
    return this.registerUser.execute(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  signIn(@Body(new ZodValidationPipe(loginRequestSchema)) dto: LoginRequest) {
    return this.login.execute(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body(new ZodValidationPipe(refreshRequestSchema)) dto: RefreshRequest) {
    return this.refreshToken.execute(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Body(new ZodValidationPipe(refreshRequestSchema)) dto: RefreshRequest) {
    await this.logout.execute(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.getProfile.execute(user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  updateMe(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) dto: UpdateProfileRequest
  ) {
    return this.updateProfile.execute({ userId: user.sub, ...dto });
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMe(@CurrentUser() user: AccessTokenPayload) {
    await this.deleteAccount.execute(user.sub);
  }
}
