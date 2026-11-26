import { FiscalNoteNotFoundError } from '@/modules/fiscal-notes/application/errors';
import { UnlinkTransactionFiscalNoteInput } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.dto';
import {
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { TransactionFiscalNotePort } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class UnlinkTransactionFiscalNoteUseCase {
  constructor(
    private readonly fiscalNoteRepository: IFiscalNoteRepository,
    private readonly transactionFiscalNotePort: TransactionFiscalNotePort,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
  ) {}

  async execute(dto: UnlinkTransactionFiscalNoteInput): Promise<void> {
    await this.dataSource.transaction(async manager => {
      const options = { manager };

      await this.transactionFiscalNotePort.assertTransactionAccessible(
        {
          userId: dto.userId,
          transactionId: dto.transactionId,
        },
        options,
      );

      const deleted = await this.fiscalNoteRepository.softDeleteByTransactionId(dto.transactionId, dto.userId, options);

      if (!deleted) {
        throw new FiscalNoteNotFoundError();
      }
    });

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.UNLINK,
    });
  }
}
