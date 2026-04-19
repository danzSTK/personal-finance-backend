import { Injectable } from '@nestjs/common';
import { IRepositoryOptions, IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { User } from '@/modules/users/domain/entities/user.entity';

@Injectable()
export class FindUserByIdUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string, options?: IRepositoryOptions): Promise<User | null> {
    const user = await this.userRepository.findById(userId, options);

    if (!user) {
      return null;
    }
    return user;
  }
}
