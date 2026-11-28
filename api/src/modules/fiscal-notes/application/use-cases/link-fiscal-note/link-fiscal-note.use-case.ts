import {
  FiscalNoteAlreadyImportedError,
  TransactionAlreadyHasFiscalNoteError,
} from '@/modules/fiscal-notes/application/errors';
import {
  buildFiscalNoteEntityFromParsed,
  handleFiscalNoteUniqueConstraintError,
} from '@/modules/fiscal-notes/application/services/fiscal-note-persistence.helper';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import { LinkFiscalNoteInput } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.dto';
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
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class LinkFiscalNoteUseCase {
  constructor(
    private readonly fiscalNoteQueryService: FiscalNoteQueryService,
    private readonly fiscalNoteRepository: IFiscalNoteRepository,
    private readonly transactionFiscalNotePort: TransactionFiscalNotePort,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
  ) {}

  async execute(dto: LinkFiscalNoteInput): Promise<FiscalNote> {
    const { parsed } = await this.fiscalNoteQueryService.resolve(dto.input, dto.userId);

    const fiscalNote = await this.dataSource.transaction(async manager => {
      const options = { manager };

      await this.transactionFiscalNotePort.lockAndValidateExpenseForFiscalNoteLink(
        {
          userId: dto.userId,
          transactionId: dto.transactionId,
        },
        options,
      );

      const existingByTransaction = await this.fiscalNoteRepository.findActiveByTransactionId(
        dto.transactionId,
        options,
      );
      if (existingByTransaction) {
        throw new TransactionAlreadyHasFiscalNoteError(existingByTransaction.id);
      }

      const existingByKey = await this.fiscalNoteRepository.findActiveByUserIdAndAccessKey(
        dto.userId,
        parsed.accessKey,
        options,
      );
      if (existingByKey) {
        throw new FiscalNoteAlreadyImportedError(existingByKey.transactionId, existingByKey.id);
      }

      const newFiscalNote = buildFiscalNoteEntityFromParsed({
        userId: dto.userId,
        transactionId: dto.transactionId,
        parsed,
      });

      try {
        return await this.fiscalNoteRepository.save(newFiscalNote, options);
      } catch (error: unknown) {
        return handleFiscalNoteUniqueConstraintError({
          error,
          userId: dto.userId,
          transactionId: dto.transactionId,
          accessKey: parsed.accessKey,
          fiscalNoteRepository: this.fiscalNoteRepository,
        });
      }
    });

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.LINK,
    });

    return fiscalNote;
  }
}
