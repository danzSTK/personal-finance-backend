import { Injectable } from '@nestjs/common';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IRepositoryOptions, IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';

@Injectable()
export class FindUserByEmailUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(email: string, options?: IRepositoryOptions): Promise<User | null> {
    const emailVO = Email.create(email);

    return this.userRepository.findByEmail(emailVO, options);
  }
}
