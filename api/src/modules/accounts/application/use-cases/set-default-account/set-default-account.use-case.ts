import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { type SetDefaultAccountUseCaseDto } from './set-default-account.dto';

@Injectable()
export class SetDefaultAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: SetDefaultAccountUseCaseDto): Promise<void> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.isArchived) {
      throw new ConflictException('Archived account cannot be set as default');
    }

    await this.accountRepository.unsetDefaultAccount(data.userId);
    account.setAsDefault();
    await this.accountRepository.save(account);
  }
}
