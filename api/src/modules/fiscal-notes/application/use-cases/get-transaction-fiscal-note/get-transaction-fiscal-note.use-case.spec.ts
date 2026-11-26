/* eslint-disable @typescript-eslint/unbound-method */
import { FiscalNoteNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { GetTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.use-case';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { TransactionFiscalNotePort } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';

describe('GetTransactionFiscalNoteUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '44444444-4444-4444-a444-444444444444';

  let useCase: GetTransactionFiscalNoteUseCase;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let transactionPort: jest.Mocked<TransactionFiscalNotePort>;

  beforeEach(async () => {
    jest.clearAllMocks();

    fiscalNoteRepository = {
      findActiveByTransactionIdAndUserId: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    transactionPort = {
      assertTransactionAccessible: jest.fn(),
    } as unknown as jest.Mocked<TransactionFiscalNotePort>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetTransactionFiscalNoteUseCase,
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: TransactionFiscalNotePort, useValue: transactionPort },
        { provide: METRICS_RECORDER, useValue: { incrementCounter: jest.fn(), observeDuration: jest.fn() } },
      ],
    }).compile();

    useCase = moduleRef.get(GetTransactionFiscalNoteUseCase);
  });

  describe('execute', () => {
    it('asserts transaction access and returns active fiscal note', async () => {
      const note = { id: 'note-1', transactionId } as FiscalNote;
      transactionPort.assertTransactionAccessible.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.findActiveByTransactionIdAndUserId.mockResolvedValue(note);

      const result = await useCase.execute({ userId, transactionId });

      expect(transactionPort.assertTransactionAccessible).toHaveBeenCalledWith({ userId, transactionId });
      expect(fiscalNoteRepository.findActiveByTransactionIdAndUserId).toHaveBeenCalledWith(transactionId, userId);
      expect(result).toBe(note);
    });

    it('throws FiscalNoteNotFoundError when transaction has no active fiscal note', async () => {
      transactionPort.assertTransactionAccessible.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.findActiveByTransactionIdAndUserId.mockResolvedValue(null);

      await expect(useCase.execute({ userId, transactionId })).rejects.toThrow(FiscalNoteNotFoundError);
    });
  });
});
