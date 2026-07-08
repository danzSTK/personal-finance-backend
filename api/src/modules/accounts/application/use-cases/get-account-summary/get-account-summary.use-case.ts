import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import { Injectable } from '@nestjs/common';
import { GetAccountSummaryUseCaseInput, GetAccountSummaryUseCaseOutput } from './get-account-summary.dto';

@Injectable()
export class GetAccountSummaryUseCase {
  constructor(private readonly accountBalanceRepository: IAccountBalanceRepository) {}

  async execute(input: GetAccountSummaryUseCaseInput): Promise<GetAccountSummaryUseCaseOutput> {
    return this.accountBalanceRepository.getUserSummary({
      userId: input.userId,
      includeArchived: input.includeArchived ?? false,
      includeExcludedFromTotal: input.includeExcludedFromTotal ?? false,
      projectedUntil: input.projectedUntil,
    });
  }
}
