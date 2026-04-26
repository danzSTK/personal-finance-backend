import { Injectable } from '@nestjs/common';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { type ListAccountsUseCaseDto } from './list-accounts.dto';

@Injectable()
export class ListAccountsUseCase {
  constructor(private readonly accountRepository: IAccountRepository) {}

  async execute(data: ListAccountsUseCaseDto): Promise<Account[]> {
    return this.accountRepository.listByUserId(data.userId, data.includeArchived ?? false);
  }
}
