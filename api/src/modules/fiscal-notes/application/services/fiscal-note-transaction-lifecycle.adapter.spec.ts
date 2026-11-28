import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { FiscalNoteTransactionLifecycleAdapter } from '@/modules/fiscal-notes/application/services/fiscal-note-transaction-lifecycle.adapter';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';

describe('FiscalNoteTransactionLifecycleAdapter', () => {
  let adapter: FiscalNoteTransactionLifecycleAdapter;
  let mockRepository: {
    findActiveByUserIdAndAccessKey: jest.Mock;
    findActiveByTransactionId: jest.Mock;
    findActiveByTransactionIdAndUserId: jest.Mock;
    hasActiveByTransactionId: jest.Mock;
    findActiveTransactionIds: jest.Mock;
    save: jest.Mock;
    softDeleteByTransactionId: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockRepository = {
      findActiveByUserIdAndAccessKey: jest.fn(),
      findActiveByTransactionId: jest.fn(),
      findActiveByTransactionIdAndUserId: jest.fn(),
      hasActiveByTransactionId: jest.fn(),
      findActiveTransactionIds: jest.fn(),
      save: jest.fn(),
      softDeleteByTransactionId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalNoteTransactionLifecycleAdapter, { provide: IFiscalNoteRepository, useValue: mockRepository }],
    }).compile();

    adapter = module.get(FiscalNoteTransactionLifecycleAdapter);
  });

  describe('hasActiveByTransactionId', () => {
    it('should delegate to repository forwarding options', async () => {
      const transactionId = randomUUID();
      const options: IRepositoryOptions = { manager: {} as EntityManager };
      mockRepository.hasActiveByTransactionId.mockResolvedValue(true);

      const result = await adapter.hasActiveByTransactionId(transactionId, options);

      expect(result).toBe(true);
      expect(mockRepository.hasActiveByTransactionId).toHaveBeenCalledWith(transactionId, options);
    });
  });

  describe('findActiveTransactionIds', () => {
    it('should delegate batch lookup to repository', async () => {
      const ids = [randomUUID(), randomUUID()];
      const activeSet = new Set([ids[0]]);
      mockRepository.findActiveTransactionIds.mockResolvedValue(activeSet);

      const result = await adapter.findActiveTransactionIds(ids);

      expect(result).toBe(activeSet);
      expect(mockRepository.findActiveTransactionIds).toHaveBeenCalledWith(ids, undefined);
    });
  });

  describe('softDeleteByTransactionId', () => {
    it('should delegate soft delete within transaction manager to repository', async () => {
      const transactionId = randomUUID();
      const userId = randomUUID();
      const options: Required<IRepositoryOptions> = { manager: {} as EntityManager };
      mockRepository.softDeleteByTransactionId.mockResolvedValue(true);

      const result = await adapter.softDeleteByTransactionId(transactionId, userId, options);

      expect(result).toBe(true);
      expect(mockRepository.softDeleteByTransactionId).toHaveBeenCalledWith(transactionId, userId, options);
    });
  });
});
