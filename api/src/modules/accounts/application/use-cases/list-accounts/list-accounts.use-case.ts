import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';
import { type ListAccountsUseCaseInput, ListAccountsUseCaseOutput } from './list-accounts.dto';

@Injectable()
export class ListAccountsUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: ListAccountsUseCaseInput): Promise<ListAccountsUseCaseOutput> {
    return this.accountRepository.listByUserId(data.userId, data.includeArchived ?? false);
  }
}
