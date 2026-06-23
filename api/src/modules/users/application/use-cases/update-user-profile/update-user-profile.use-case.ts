import { applyIfDefined } from '@/common/utils/utils';
import { UserNotFoundError } from '@/modules/users/application/errors';
import { UserUpdateInputVoidError } from '@/modules/users/application/errors/user-update-input-void.error';
import {
  UpdateUserProfileInput,
  UpdateUserProfileOutput,
} from '@/modules/users/application/use-cases/update-user-profile/update-user-profile.dto';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class UpdateUserProfileUseCase {
  constructor(private readonly userRepository: IUserRepository) {}
  async execute(input: UpdateUserProfileInput): Promise<UpdateUserProfileOutput> {
    if (input.firstName === undefined && input.lastName === undefined) {
      throw new UserUpdateInputVoidError();
    }

    if (!input.user) {
      throw new UserNotFoundError('We were unable to capture the user from the request.');
    }

    const { user, firstName, lastName } = input;

    applyIfDefined(firstName, value => user.changerFirstName(value));
    applyIfDefined(lastName, value => user.changerLastName(value));

    return await this.userRepository.save(user);
  }
}
