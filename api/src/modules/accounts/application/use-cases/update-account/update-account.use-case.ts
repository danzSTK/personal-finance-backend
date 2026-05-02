import { applyIfDefined } from '@/common/utils/utils';
import { UpdateAccountUseCaseInput } from '@/modules/accounts/application/use-cases/update-account/update-account.dto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class UpdateAccountUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: UpdateAccountUseCaseInput): Promise<Account> {
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId);

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    if (account.isArchived) {
      throw new ConflictException('Archived account cannot be updated');
    }

    const hasAnyField = Object.values(data.patch).some(v => v !== undefined);

    if (!hasAnyField || !data) {
      throw new ConflictException('At least one field must be provided for update');
    }

    applyIfDefined(data.patch.name, value => account.changerName(value));
    applyIfDefined(data.patch.type, value => account.changerType(value));
    applyIfDefined(data.patch.color, value => account.changerColor(value));
    applyIfDefined(data.patch.icon, value => account.changerIcon(value));
    applyIfDefined(data.patch.includeInTotal, value => account.changerIncludeInTotal(value));

    return this.accountRepository.save(account);
  }
}
