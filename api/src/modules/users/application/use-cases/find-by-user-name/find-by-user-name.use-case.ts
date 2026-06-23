import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FindUserByUserNameUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userName: string, options?: IRepositoryOptions): Promise<User | null> {
    const userNameVO = UserName.create(userName);

    return this.userRepository.findByUserName(userNameVO, options);
  }
}
