import {
  TRANSACTION_AMOUNT_CENTS_MAX,
  TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION,
} from '@/common/models/constants';
import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { IAccountBalanceRepository } from '@/modules/accounts/domain/repositories/account-balance.repository.interface';
import {
  BalanceAdjustmentNoDifferenceError,
  TransactionAccountUnavailableError,
} from '@/modules/transactions/application/errors';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import {
  CreateBalanceAdjustmentUseCaseInput,
  CreateBalanceAdjustmentUseCaseOutput,
} from '@/modules/transactions/application/use-cases/create-balance-adjustment/create-balance-adjustment.dto';
import { InvalidTransactionError } from '@/modules/transactions/domain/errors';
import { TransactionFactory } from '@/modules/transactions/domain/factories/transaction.factory';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class CreateBalanceAdjustmentUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountBalanceRepository: IAccountBalanceRepository,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(data: CreateBalanceAdjustmentUseCaseInput): Promise<CreateBalanceAdjustmentUseCaseOutput> {
    if (!Number.isSafeInteger(data.targetBalanceCents)) {
      throw new InvalidTransactionError('Target balance cents must be a safe integer.');
    }

    return this.dataSource.transaction(async manager => {
      const options = { manager };
      const references = await this.transactionReferenceValidator.validateForBalanceAdjustment(
        {
          userId: data.userId,
          accountId: data.accountId,
        },
        options,
      );

      const [balanceSummary] = await this.accountBalanceRepository.getSummaries(
        {
          userId: data.userId,
          accountIds: [data.accountId],
        },
        options,
      );

      if (!balanceSummary) {
        throw new TransactionAccountUnavailableError('Transaction account does not exist or is archived.');
      }

      const deltaCents = BigInt(data.targetBalanceCents) - BigInt(balanceSummary.currentCents);

      if (deltaCents === 0n) {
        throw new BalanceAdjustmentNoDifferenceError();
      }

      const direction = deltaCents > 0n ? TransactionDirection.INCREASE : TransactionDirection.DECREASE;
      const absoluteDeltaCents = deltaCents > 0n ? deltaCents : -deltaCents;

      if (absoluteDeltaCents > BigInt(TRANSACTION_AMOUNT_CENTS_MAX)) {
        throw new InvalidTransactionError('Balance adjustment amount exceeds maximum allowed value.');
      }

      const description = this.resolveDescription(data.description);
      const transaction = TransactionFactory.create({
        userId: data.userId,
        accountId: data.accountId,
        destinationAccountId: null,
        categoryId: references.category.id,
        type: TransactionType.ADJUSTMENT,
        status: TransactionStatus.EFFECTIVE,
        amountCents: Number(absoluteDeltaCents),
        date: data.date,
        description,
        direction,
      });

      return this.transactionRepository.save(transaction, options);
    });
  }

  private resolveDescription(description: string | null | undefined): string {
    const trimmed = description?.trim();

    if (trimmed && trimmed.length > 0) {
      return trimmed;
    }

    return TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION;
  }
}
