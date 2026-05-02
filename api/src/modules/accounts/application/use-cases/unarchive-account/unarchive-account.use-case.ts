import { UnarchiveAccountUseCaseInput } from '@/modules/accounts/application/use-cases/unarchive-account/unarchive-account.dto';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UnarchiveAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: UnarchiveAccountUseCaseInput): Promise<void> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (!account.isArchived) {
      throw new ConflictException('Account is not archived');
    }

    account.unarchive();

    await this.accountRepository.save(account);
  }
}
