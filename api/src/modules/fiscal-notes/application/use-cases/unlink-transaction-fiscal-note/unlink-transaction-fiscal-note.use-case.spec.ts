/* eslint-disable @typescript-eslint/unbound-method */
import { FiscalNoteNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { UnlinkTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.use-case';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { TransactionFiscalNotePort } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';

describe('UnlinkTransactionFiscalNoteUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const transactionId = '44444444-4444-4444-a444-444444444444';

  let useCase: UnlinkTransactionFiscalNoteUseCase;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let transactionPort: jest.Mocked<TransactionFiscalNotePort>;
  let manager: EntityManager;
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    manager = {} as EntityManager;
    dataSource = {
      transaction: jest.fn((cb: (em: EntityManager) => Promise<unknown>) => cb(manager)),
    };
    fiscalNoteRepository = {
      softDeleteByTransactionId: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    transactionPort = {
      assertTransactionAccessible: jest.fn(),
    } as unknown as jest.Mocked<TransactionFiscalNotePort>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        UnlinkTransactionFiscalNoteUseCase,
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: TransactionFiscalNotePort, useValue: transactionPort },
        { provide: DataSource, useValue: dataSource },
        { provide: METRICS_RECORDER, useValue: { incrementCounter: jest.fn(), observeDuration: jest.fn() } },
      ],
    }).compile();

    useCase = moduleRef.get(UnlinkTransactionFiscalNoteUseCase);
  });

  describe('execute', () => {
    it('asserts transaction access and soft deletes only the fiscal note within transaction', async () => {
      transactionPort.assertTransactionAccessible.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.softDeleteByTransactionId.mockResolvedValue(true);

      await expect(useCase.execute({ userId, transactionId })).resolves.toBeUndefined();

      expect(transactionPort.assertTransactionAccessible).toHaveBeenCalledWith({ userId, transactionId }, { manager });
      expect(fiscalNoteRepository.softDeleteByTransactionId).toHaveBeenCalledWith(transactionId, userId, { manager });
    });

    it('throws FiscalNoteNotFoundError when no active fiscal note exists for transaction', async () => {
      transactionPort.assertTransactionAccessible.mockResolvedValue({ id: transactionId } as Transaction);
      fiscalNoteRepository.softDeleteByTransactionId.mockResolvedValue(false);

      await expect(useCase.execute({ userId, transactionId })).rejects.toThrow(FiscalNoteNotFoundError);
    });
  });
});
