import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { ListTransactionsResponseDto } from './list-transactions.response.dto';

describe('ListTransactionsResponseDto', () => {
  const userId = '5e37b15e-4f8e-494f-a5cd-31f53e773a74';
  const accountId = 'a6e1a79f-6fbd-441d-93b7-458de6cf1f35';
  const categoryId = '4d8d1ac9-6ce7-4d51-8899-6e9dfd430952';

  it('adds response object identifiers for grouped summary', () => {
    const response = ListTransactionsResponseDto.fromUseCaseOutput({
      items: [createTransaction()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      summary: {
        income: {
          pendingCents: 120000,
          effectiveCents: 300000,
          totalCents: 420000,
        },
        expense: {
          pendingCents: 80000,
          effectiveCents: 150000,
          totalCents: 230000,
        },
        balance: {
          pendingDeltaCents: 40000,
          effectiveDeltaCents: 150000,
          expectedBalanceCents: 190000,
        },
      },
    });

    expect(response.object).toBe(RESPONSE_OBJECT_TYPES.TRANSACTION_LIST);
    expect(response.summary.object).toBe(RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_OVERVIEW);
  });

  it('adds response object identifiers for type summary', () => {
    const response = ListTransactionsResponseDto.fromUseCaseOutput({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
      summary: {
        pendingCents: 80000,
        effectiveCents: 150000,
        totalCents: 230000,
      },
    });

    expect(response.object).toBe(RESPONSE_OBJECT_TYPES.TRANSACTION_LIST);
    expect(response.summary.object).toBe(RESPONSE_OBJECT_TYPES.TRANSACTION_SUMMARY_TYPE);
  });

  function createTransaction(): Transaction {
    const now = new Date('2026-06-23T12:00:00.000Z');

    return Transaction.create(
      {
        userId,
        accountId,
        destinationAccountId: null,
        categoryId,
        type: TransactionType.INCOME,
        status: TransactionStatus.EFFECTIVE,
        amountCents: 300000,
        date: '2026-06-23' as DateOnlyString,
        effectiveAt: now,
        description: 'Salario',
        direction: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      '2f9f2b7d-881e-41bd-9cde-27f7e10f30f0',
    );
  }
});
