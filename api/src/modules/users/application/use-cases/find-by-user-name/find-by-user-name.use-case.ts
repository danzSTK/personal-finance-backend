import { User } from '../../../domain/entities/user.entity';
import { IRepositoryOptions, IUserRepository } from '../../../domain/repositories/user.respository.interface';
import { UserName } from '../../../domain/value-objects/user-name.value-object';

export class FindUserByUserNameUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userName: string, options?: IRepositoryOptions): Promise<User | null> {
    const userNameVO = UserName.create(userName);

    return this.userRepository.findByUserName(userNameVO, options);
  }
}
