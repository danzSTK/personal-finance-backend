/* eslint-disable @typescript-eslint/unbound-method */
import { CategoryType, TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { toDateOnly } from '@/common/utils/date-only';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountBalanceLockPort } from '@/modules/accounts/application/ports/account-balance-lock.port';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { TransactionFiscalNoteAdapter } from '@/modules/transactions/application/services/transaction-fiscal-note.adapter';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionTypeDoesNotSupportFiscalNoteError } from '@/modules/transactions/domain/errors';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { EntityManager } from 'typeorm';

describe('TransactionFiscalNoteAdapter', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '22222222-2222-4222-a222-222222222222';
  const accountId = '33333333-3333-4333-a333-333333333333';
  const categoryId = '44444444-4444-4444-a444-444444444444';
  const destinationAccountId = '55555555-5555-4555-a555-555555555555';

  let adapter: TransactionFiscalNoteAdapter;
  let transactionRepository: jest.Mocked<ITransactionRepository>;
  let accountBalanceLockPort: jest.Mocked<AccountBalanceLockPort>;
  let referenceValidator: jest.Mocked<TransactionReferenceValidator>;
  let manager: jest.Mocked<EntityManager>;

  beforeEach(() => {
    jest.clearAllMocks();

    manager = {} as unknown as jest.Mocked<EntityManager>;

    transactionRepository = {
      findByIdAndUserId: jest.fn(),
      findByIdAndUserIdForUpdate: jest.fn(),
      list: jest.fn(),
      save: jest.fn().mockImplementation((tx: Transaction) => Promise.resolve(tx)),
    } as unknown as jest.Mocked<ITransactionRepository>;

    accountBalanceLockPort = {
      lockAccountsForBalanceMutation: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AccountBalanceLockPort>;

    referenceValidator = {
      validate: jest.fn().mockResolvedValue({
        account: { id: accountId } as unknown as Account,
        destinationAccount: null,
        category: { id: categoryId, type: CategoryType.EXPENSE } as unknown as Category,
      }),
    } as unknown as jest.Mocked<TransactionReferenceValidator>;

    adapter = new TransactionFiscalNoteAdapter(transactionRepository, accountBalanceLockPort, referenceValidator);
  });

  describe('createExpenseWithinTransaction', () => {
    it('locks account, validates expense references, persists transaction and marks hasFiscalNote=true', async () => {
      const result = await adapter.createExpenseWithinTransaction(
        {
          userId,
          accountId,
          categoryId,
          amountCents: 1590,
          date: toDateOnly('2026-10-15'),
          description: 'SUPERMERCADO MODELO',
          status: TransactionStatus.EFFECTIVE,
        },
        { manager },
      );

      expect(accountBalanceLockPort.lockAccountsForBalanceMutation).toHaveBeenCalledWith(
        { userId, accountIds: [accountId] },
        { manager },
      );
      expect(referenceValidator.validate).toHaveBeenCalledWith(
        {
          userId,
          accountId,
          destinationAccountId: null,
          categoryId,
          type: TransactionType.EXPENSE,
        },
        { manager },
      );
      expect(transactionRepository.save).toHaveBeenCalledWith(expect.any(Transaction), { manager });
      expect(result.type).toBe(TransactionType.EXPENSE);
      expect(result.status).toBe(TransactionStatus.EFFECTIVE);
      expect(result.amountCents).toBe(1590);
      expect(result.date).toBe('2026-10-15');
      expect(result.description).toBe('SUPERMERCADO MODELO');
      expect(result.categoryId).toBe(categoryId);
      expect(result.hasFiscalNote).toBe(true);
    });
  });

  describe('lockAndValidateExpenseForFiscalNoteLink', () => {
    it('locks and returns transaction when it is an EXPENSE owned by the user', async () => {
      const expense = createDomainTransaction(TransactionType.EXPENSE);
      transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(expense);

      const result = await adapter.lockAndValidateExpenseForFiscalNoteLink({ userId, transactionId }, { manager });

      expect(transactionRepository.findByIdAndUserIdForUpdate).toHaveBeenCalledWith(transactionId, userId, { manager });
      expect(result).toBe(expense);
    });

    it('throws TransactionNotFoundError when transaction does not exist', async () => {
      transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(null);

      await expect(
        adapter.lockAndValidateExpenseForFiscalNoteLink({ userId, transactionId }, { manager }),
      ).rejects.toThrow(TransactionNotFoundError);
    });

    it.each([TransactionType.INCOME, TransactionType.TRANSFER, TransactionType.ADJUSTMENT])(
      'throws TransactionTypeDoesNotSupportFiscalNoteError when transaction type is %s',
      async type => {
        const tx = createDomainTransaction(type);
        transactionRepository.findByIdAndUserIdForUpdate.mockResolvedValue(tx);

        await expect(
          adapter.lockAndValidateExpenseForFiscalNoteLink({ userId, transactionId }, { manager }),
        ).rejects.toThrow(TransactionTypeDoesNotSupportFiscalNoteError);
      },
    );
  });

  describe('assertTransactionAccessible', () => {
    it('returns transaction when accessible to the user', async () => {
      const tx = createDomainTransaction(TransactionType.EXPENSE);
      transactionRepository.findByIdAndUserId.mockResolvedValue(tx);

      const result = await adapter.assertTransactionAccessible({ userId, transactionId }, { manager });

      expect(transactionRepository.findByIdAndUserId).toHaveBeenCalledWith(transactionId, userId, { manager });
      expect(result).toBe(tx);
    });

    it('throws TransactionNotFoundError when transaction is not accessible', async () => {
      transactionRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(adapter.assertTransactionAccessible({ userId, transactionId })).rejects.toThrow(
        TransactionNotFoundError,
      );
    });
  });

  function createDomainTransaction(type: TransactionType): Transaction {
    const now = new Date('2026-10-15T12:00:00.000Z');

    return Transaction.create(
      {
        userId,
        accountId,
        destinationAccountId: type === TransactionType.TRANSFER ? destinationAccountId : null,
        categoryId,
        type,
        status: TransactionStatus.EFFECTIVE,
        amountCents: 1590,
        date: toDateOnly('2026-10-15'),
        effectiveAt: now,
        description: type === TransactionType.ADJUSTMENT ? 'Ajuste' : 'Compra',
        direction: type === TransactionType.ADJUSTMENT ? TransactionDirection.INCREASE : null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      transactionId,
    );
  }
});
