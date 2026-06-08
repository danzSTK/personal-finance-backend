import {
  CheckUsernameAvailabilityReason,
  CheckUsernameAvailabilityUseCaseInput,
  CheckUsernameAvailabilityUseCaseOutput,
} from '@/modules/users/application/use-cases/check-username-availability/check-username.dto';
import { InvalidUsernameFormatError } from '@/modules/users/domain/errors';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CheckUsernameAvailabilityUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(data: CheckUsernameAvailabilityUseCaseInput): Promise<CheckUsernameAvailabilityUseCaseOutput> {
    try {
      const userName = UserName.create(data.username);
      const alreadyExists = await this.userRepository.usernameAlreadyExists(userName);

      if (alreadyExists) {
        return {
          available: false,
          reason: CheckUsernameAvailabilityReason.ALREADY_EXISTS,
          username: userName.value,
        };
      }

      return {
        available: true,
        reason: CheckUsernameAvailabilityReason.AVAILABLE,
        username: userName.value,
      };
    } catch (error) {
      if (error instanceof InvalidUsernameFormatError) {
        return {
          available: false,
          reason: CheckUsernameAvailabilityReason.INVALID_FORMAT,
          username: data.username,
        };
      }

      throw error;
    }
  }
}
