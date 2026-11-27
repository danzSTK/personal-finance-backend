/* eslint-disable @typescript-eslint/unbound-method */
import { FiscalNoteNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { GetFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-fiscal-note/get-fiscal-note.use-case';
import {
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Test } from '@nestjs/testing';

describe('GetFiscalNoteUseCase', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const fiscalNoteId = '55555555-5555-4555-a555-555555555555';

  let useCase: GetFiscalNoteUseCase;
  let fiscalNoteRepository: jest.Mocked<IFiscalNoteRepository>;
  let metricsRecorder: jest.Mocked<IMetricsRecorder>;

  beforeEach(async () => {
    jest.clearAllMocks();

    fiscalNoteRepository = {
      findActiveByIdAndUserId: jest.fn(),
    } as unknown as jest.Mocked<IFiscalNoteRepository>;
    metricsRecorder = {
      incrementCounter: jest.fn(),
      observeDuration: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetFiscalNoteUseCase,
        { provide: IFiscalNoteRepository, useValue: fiscalNoteRepository },
        { provide: METRICS_RECORDER, useValue: metricsRecorder },
      ],
    }).compile();

    useCase = moduleRef.get(GetFiscalNoteUseCase);
  });

  describe('execute', () => {
    it('returns active fiscal note for the authenticated user and increments get metric', async () => {
      const note = { id: fiscalNoteId, userId } as FiscalNote;
      fiscalNoteRepository.findActiveByIdAndUserId.mockResolvedValue(note);

      const result = await useCase.execute({ userId, fiscalNoteId });

      expect(fiscalNoteRepository.findActiveByIdAndUserId).toHaveBeenCalledWith(fiscalNoteId, userId);
      expect(result).toBe(note);
      expect(metricsRecorder.incrementCounter).toHaveBeenCalledWith(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
        [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.GET,
      });
    });

    it('throws FiscalNoteNotFoundError when fiscal note is not found or belongs to another user', async () => {
      fiscalNoteRepository.findActiveByIdAndUserId.mockResolvedValue(null);

      await expect(useCase.execute({ userId, fiscalNoteId })).rejects.toThrow(FiscalNoteNotFoundError);
      expect(metricsRecorder.incrementCounter).not.toHaveBeenCalled();
    });
  });
});
