import { FiscalNoteNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { GetTransactionFiscalNoteInput } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.dto';
import {
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { TransactionFiscalNotePort } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Inject, Injectable, Optional } from '@nestjs/common';

@Injectable()
export class GetTransactionFiscalNoteUseCase {
  constructor(
    private readonly fiscalNoteRepository: IFiscalNoteRepository,
    private readonly transactionFiscalNotePort: TransactionFiscalNotePort,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
  ) {}

  async execute(dto: GetTransactionFiscalNoteInput): Promise<FiscalNote> {
    await this.transactionFiscalNotePort.assertTransactionAccessible({
      userId: dto.userId,
      transactionId: dto.transactionId,
    });

    const fiscalNote = await this.fiscalNoteRepository.findActiveByTransactionIdAndUserId(
      dto.transactionId,
      dto.userId,
    );

    if (!fiscalNote) {
      throw new FiscalNoteNotFoundError();
    }

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.GET,
    });

    return fiscalNote;
  }
}
