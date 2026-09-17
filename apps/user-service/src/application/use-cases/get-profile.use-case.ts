import { Inject, Injectable } from '@nestjs/common';
import { NotFoundException } from '@ecommerce-platform/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../ports/user-repository.port';
import { UserProfile, toUserProfile } from '../dto/user-profile.dto';

@Injectable()
export class GetProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  async execute(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found', { userId });
    }
    return toUserProfile(user);
  }
}
