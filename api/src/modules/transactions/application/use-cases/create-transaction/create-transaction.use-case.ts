import { TransactionType } from '@/common/models/enums';
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import {
  CreateTransactionUseCaseInput,
  CreateTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.dto';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { TransactionFactory } from '@/modules/transactions/domain/factories/transaction.factory';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountBalanceLockPort: AccountBalanceLockPort,
    private readonly transactionReferenceValidator: TransactionReferenceValidator,
  ) {}

  async execute(data: CreateTransactionUseCaseInput): Promise<CreateTransactionUseCaseOutput> {
    return this.dataSource.transaction(async manager => {
      const options = { manager };
      const accountIdsToLock = [
        data.accountId,
        ...(data.type === TransactionType.TRANSFER && data.destinationAccountId ? [data.destinationAccountId] : []),
      ];

      await this.accountBalanceLockPort.lockAccountsForBalanceMutation(
        {
          userId: data.userId,
          accountIds: accountIdsToLock,
        },
        options,
      );

      const references = await this.transactionReferenceValidator.validate(
        {
          userId: data.userId,
          accountId: data.accountId,
          destinationAccountId: data.destinationAccountId ?? null,
          categoryId: data.categoryId,
          type: data.type,
        },
        options,
      );

      const transaction = TransactionFactory.create({
        ...data,
        categoryId: references.category.id,
      });

      return this.transactionRepository.save(transaction, options);
    });
  }
}
