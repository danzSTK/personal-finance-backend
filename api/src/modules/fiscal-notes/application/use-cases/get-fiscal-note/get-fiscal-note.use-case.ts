import { FiscalNoteNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { GetFiscalNoteInput } from '@/modules/fiscal-notes/application/use-cases/get-fiscal-note/get-fiscal-note.dto';
import {
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Inject, Injectable, Optional } from '@nestjs/common';

@Injectable()
export class GetFiscalNoteUseCase {
  constructor(
    private readonly fiscalNoteRepository: IFiscalNoteRepository,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
  ) {}

  async execute(dto: GetFiscalNoteInput): Promise<FiscalNote> {
    const fiscalNote = await this.fiscalNoteRepository.findActiveByIdAndUserId(dto.fiscalNoteId, dto.userId);

    if (!fiscalNote) {
      throw new FiscalNoteNotFoundError();
    }

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.GET,
    });

    return fiscalNote;
  }
}
