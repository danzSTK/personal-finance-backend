import { Injectable } from '@nestjs/common';
import { UserStatus } from '../../../../../common/models/enums';
import { IHashService } from '../../../../../common/models/interfaces';
import { User } from '../../../../users/domain/entities/user.entity';
import { FindUserByEmailUseCase } from '../../../../users/application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { type ValidateCredentialsUseCaseDto } from './validate-credentials.dto';

@Injectable()
export class ValidateCredentialsUseCase {
  constructor(
    private readonly findUserByEmailUseCase: FindUserByEmailUseCase,
    private readonly hashService: IHashService,
  ) {}

  async execute(data: ValidateCredentialsUseCaseDto): Promise<User | null> {
    const { email, password } = data;

    const user = await this.findUserByEmailUseCase.execute(email);

    if (!user) {
      return null;
    }

    const credentialsProvider = user.getCredentialsAuthProvider();

    if (!credentialsProvider) {
      return null;
    }

    const isValid = await this.hashService.compare(password, credentialsProvider.passwordHash.value);

    if (!isValid) {
      return null;
    }

    if (user.status === UserStatus.BLOCKED) {
      return null;
    }

    return user;
  }
}
