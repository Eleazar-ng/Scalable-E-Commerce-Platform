import { Inject, Injectable } from '@nestjs/common';
import { NotFoundException } from '@ecommerce-platform/common';
import { USER_REPOSITORY, UserRepositoryPort } from '../ports/user-repository.port';
import { UserProfile, toUserProfile } from '../dto/user-profile.dto';

export interface UpdateProfileInput {
  userId: string;
  firstName: string;
  lastName: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: UserRepositoryPort) {}

  async execute(input: UpdateProfileInput): Promise<UserProfile> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found', { userId: input.userId });
    }
    
    user.updateName(input.firstName, input.lastName);
    await this.userRepository.update(user);

    return toUserProfile(user);
  }
}
