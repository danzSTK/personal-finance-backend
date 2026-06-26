import {
  TRANSACTION_LIST_DEFAULT_LIMIT,
  TRANSACTION_LIST_DEFAULT_PAGE,
  TRANSACTION_LIST_DEFAULT_SORT,
} from '@/common/models/constants';
import {
  ListTransactionsUseCaseInput,
  ListTransactionsUseCaseOutput,
} from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.dto';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ListTransactionsUseCase {
  constructor(private readonly transactionRepository: ITransactionRepository) {}

  async execute(input: ListTransactionsUseCaseInput): Promise<ListTransactionsUseCaseOutput> {
    const page = input.page ?? TRANSACTION_LIST_DEFAULT_PAGE;
    const limit = input.limit ?? TRANSACTION_LIST_DEFAULT_LIMIT;
    const sort = input.sort ?? TRANSACTION_LIST_DEFAULT_SORT;
    const { items, total, summary } = await this.transactionRepository.list({
      userId: input.userId,
      status: input.status,
      type: input.type,
      accountId: input.accountId,
      categoryId: input.categoryId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      page,
      limit,
      sort,
    });
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
      summary,
    };
  }
}
