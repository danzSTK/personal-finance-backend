import { Injectable } from '@nestjs/common';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IRepositoryOptions, IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';

@Injectable()
export class FindUserByUserNameUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userName: string, options?: IRepositoryOptions): Promise<User | null> {
    const userNameVO = UserName.create(userName);

    return this.userRepository.findByUserName(userNameVO, options);
  }
}
