import { TRANSACTION_LIST_DEFAULT_LIMIT, TRANSACTION_LIST_DEFAULT_PAGE } from '@/common/models/constants';
import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Test, TestingModule } from '@nestjs/testing';
import { ListTransactionsUseCase } from './list-transactions.use-case';

describe('ListTransactionsUseCase', () => {
  const userId = '5e37b15e-4f8e-494f-a5cd-31f53e773a74';
  const accountId = 'a6e1a79f-6fbd-441d-93b7-458de6cf1f35';
  const categoryId = '4d8d1ac9-6ce7-4d51-8899-6e9dfd430952';
  let useCase: ListTransactionsUseCase;
  let transactionRepository: jest.Mocked<Pick<ITransactionRepository, 'list'>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    transactionRepository = {
      list: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListTransactionsUseCase,
        {
          provide: ITransactionRepository,
          useValue: transactionRepository,
        },
      ],
    }).compile();

    useCase = module.get(ListTransactionsUseCase);
  });

  describe('execute', () => {
    it('uses default pagination and sort and returns summary', async () => {
      const transaction = createTransaction();
      transactionRepository.list.mockResolvedValue({
        items: [transaction],
        total: 21,
        summary: {
          currentBalanceCents: 250000,
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

      const output = await useCase.execute({ userId });

      expect(transactionRepository.list).toHaveBeenCalledWith({
        userId,
        status: undefined,
        type: undefined,
        accountId: undefined,
        categoryId: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        page: TRANSACTION_LIST_DEFAULT_PAGE,
        limit: TRANSACTION_LIST_DEFAULT_LIMIT,
        sort: 'date:desc',
      });
      expect(output).toEqual({
        items: [transaction],
        total: 21,
        page: 1,
        limit: 20,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
        summary: {
          currentBalanceCents: 250000,
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
    });

    it('passes filters, pagination and explicit sort to the repository', async () => {
      transactionRepository.list.mockResolvedValue({
        items: [],
        total: 0,
        summary: {
          pendingCents: 0,
          effectiveCents: 0,
          totalCents: 0,
        },
      });

      await useCase.execute({
        userId,
        status: TransactionStatus.PENDING,
        type: TransactionType.EXPENSE,
        accountId,
        categoryId,
        dateFrom: '2026-06-01' as DateOnlyString,
        dateTo: '2026-06-30' as DateOnlyString,
        page: 3,
        limit: 10,
        sort: 'date:asc',
      });

      expect(transactionRepository.list).toHaveBeenCalledWith({
        userId,
        status: TransactionStatus.PENDING,
        type: TransactionType.EXPENSE,
        accountId,
        categoryId,
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        page: 3,
        limit: 10,
        sort: 'date:asc',
      });
    });
  });

  function createTransaction(): Transaction {
    const now = new Date('2026-06-23T12:00:00.000Z');

    return Transaction.create(
      {
        userId,
        accountId,
        destinationAccountId: null,
        categoryId,
        type: TransactionType.ADJUSTMENT,
        status: TransactionStatus.EFFECTIVE,
        amountCents: 12000,
        date: '2026-06-23' as DateOnlyString,
        effectiveAt: now,
        description: 'Correção de saldo',
        direction: TransactionDirection.INCREASE,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      '2f9f2b7d-881e-41bd-9cde-27f7e10f30f0',
    );
  }
});
