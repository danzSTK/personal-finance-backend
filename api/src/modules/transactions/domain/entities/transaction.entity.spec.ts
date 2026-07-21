import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { DateOnlyString, toDateOnly } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import {
  InvalidTransactionError,
  TransactionCannotDeleteTransferError,
  TransactionInvalidStateTransitionError,
} from '@/modules/transactions/domain/errors';

describe('Transaction', () => {
  const transactionId = '2f9f2b7d-881e-41bd-9cde-27f7e10f30f0';
  const userId = '5e37b15e-4f8e-494f-a5cd-31f53e773a74';
  const accountId = 'a6e1a79f-6fbd-441d-93b7-458de6cf1f35';
  const destinationAccountId = 'dfe3f523-c1ad-426e-a822-4f708db64719';
  const categoryId = '4d8d1ac9-6ce7-4d51-8899-6e9dfd430952';

  it('creates an effective expense transaction with positive amount cents', () => {
    const transaction = createTransaction();

    expect(transaction.amountCents).toBe(1990);
    expect(transaction.date).toBe('2026-06-23');
    expect(transaction.status).toBe(TransactionStatus.EFFECTIVE);
    expect(transaction.effectiveAt).toBeInstanceOf(Date);
  });

  it('rejects invalid date-only strings', () => {
    expect(() => createTransaction({ date: '2026-02-31' as DateOnlyString })).toThrow(InvalidTransactionError);
    expect(() => createTransaction({ date: '2026-6-3' as DateOnlyString })).toThrow(InvalidTransactionError);
  });

  it('rejects zero or negative amount cents', () => {
    expect(() => createTransaction({ amountCents: 0 })).toThrow(InvalidTransactionError);
    expect(() => createTransaction({ amountCents: -1 })).toThrow(InvalidTransactionError);
  });

  it('requires destination account only for transfers', () => {
    expect(() =>
      createTransaction({
        type: TransactionType.TRANSFER,
        destinationAccountId: null,
      }),
    ).toThrow(InvalidTransactionError);

    expect(() =>
      createTransaction({
        type: TransactionType.EXPENSE,
        destinationAccountId,
      }),
    ).toThrow(InvalidTransactionError);
  });

  it('requires direction and description for adjustments', () => {
    expect(() =>
      createTransaction({
        type: TransactionType.ADJUSTMENT,
        direction: null,
        description: 'Correção de saldo',
      }),
    ).toThrow(InvalidTransactionError);

    expect(() =>
      createTransaction({
        type: TransactionType.ADJUSTMENT,
        direction: TransactionDirection.INCREASE,
        description: null,
      }),
    ).toThrow(InvalidTransactionError);
  });

  it('confirms a pending transaction and sets effectiveAt', () => {
    const transaction = createTransaction({
      status: TransactionStatus.PENDING,
      effectiveAt: null,
    });

    transaction.confirm({ amountCents: 2500 });

    expect(transaction.status).toBe(TransactionStatus.EFFECTIVE);
    expect(transaction.amountCents).toBe(2500);
    expect(transaction.effectiveAt).toBeInstanceOf(Date);
  });

  it('rejects confirming an already effective transaction', () => {
    const transaction = createTransaction();

    expect(() => transaction.confirm()).toThrow(TransactionInvalidStateTransitionError);
  });

  it('soft deletes non-transfer transactions and rejects transfer deletion', () => {
    const expense = createTransaction();
    expense.delete();

    expect(expense.deletedAt).toBeInstanceOf(Date);

    const transfer = createTransaction({
      type: TransactionType.TRANSFER,
      destinationAccountId,
    });

    expect(() => transfer.delete()).toThrow(TransactionCannotDeleteTransferError);
  });

  function createTransaction(overrides: Partial<Parameters<typeof Transaction.create>[0]> = {}): Transaction {
    const now = new Date('2026-06-23T12:00:00.000Z');
    const status = overrides.status ?? TransactionStatus.EFFECTIVE;

    return Transaction.create(
      {
        userId,
        accountId,
        destinationAccountId: null,
        categoryId,
        type: TransactionType.EXPENSE,
        status,
        amountCents: 1990,
        date: toDateOnly('2026-06-23'),
        effectiveAt: status === TransactionStatus.EFFECTIVE ? now : null,
        description: 'Mercado',
        direction: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      },
      transactionId,
    );
  }
});
