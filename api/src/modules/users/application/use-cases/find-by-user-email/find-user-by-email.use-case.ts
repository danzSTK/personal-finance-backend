import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FindUserByEmailUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(email: string, options?: IRepositoryOptions): Promise<User | null> {
    const emailVO = Email.create(email);

    return this.userRepository.findByEmail(emailVO, options);
  }
}
