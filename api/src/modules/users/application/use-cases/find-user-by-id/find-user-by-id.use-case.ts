import { Injectable, NotFoundException } from '@nestjs/common';
import { IRepositoryOptions, IUserRepository } from '../../../domain/repositories/user.respository.interface';
import { User } from '../../../domain/entities/user.entity';

@Injectable()
export class FindUserByIdUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(userId: string, options?: IRepositoryOptions): Promise<User> {
    const user = await this.userRepository.findById(userId, options);

    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    return user;
  }
}
