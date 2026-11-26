import { TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import {
  PreviewFiscalNoteInput,
  PreviewFiscalNoteOutput,
} from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.dto';
import {
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Inject, Injectable, Optional } from '@nestjs/common';

@Injectable()
export class PreviewFiscalNoteUseCase {
  constructor(
    private readonly fiscalNoteQueryService: FiscalNoteQueryService,
    private readonly fiscalNoteRepository: IFiscalNoteRepository,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
  ) {}

  async execute(dto: PreviewFiscalNoteInput): Promise<PreviewFiscalNoteOutput> {
    const { parsed, cacheHit } = await this.fiscalNoteQueryService.resolve(dto.input, dto.userId);
    const existing = await this.fiscalNoteRepository.findActiveByUserIdAndAccessKey(dto.userId, parsed.accessKey);

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.PREVIEW,
    });

    return {
      alreadyImported: existing !== null,
      existingTransactionId: existing?.transactionId ?? null,
      existingFiscalNoteId: existing?.id ?? null,
      cacheHit,
      suggestedTransaction: {
        type: TransactionType.EXPENSE,
        status: TransactionStatus.EFFECTIVE,
        amountCents: parsed.payableAmountCents,
        date: parsed.issuedDate,
        description: parsed.issuerName.slice(0, TRANSACTION_DESCRIPTION_MAX_LENGTH),
      },
      fiscalNote: parsed,
    };
  }
}
