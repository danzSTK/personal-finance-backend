import { TRANSACTION_AMOUNT_CENTS_MAX, TRANSACTION_DESCRIPTION_MAX_LENGTH } from '@/common/models/constants';
import { TransactionStatus } from '@/common/models/enums';
import { FiscalNoteAlreadyImportedError } from '@/modules/fiscal-notes/application/errors';
import {
  buildFiscalNoteEntityFromParsed,
  handleFiscalNoteUniqueConstraintError,
} from '@/modules/fiscal-notes/application/services/fiscal-note-persistence.helper';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import {
  ImportFiscalNoteInput,
  ImportFiscalNoteOutput,
} from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.dto';
import {
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { TransactionFiscalNotePort } from '@/modules/transactions/application/ports/transaction-fiscal-note.port';
import { InvalidTransactionError } from '@/modules/transactions/domain/errors';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ImportFiscalNoteUseCase {
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

  async execute(dto: ImportFiscalNoteInput): Promise<ImportFiscalNoteOutput> {
    const { parsed } = await this.fiscalNoteQueryService.resolve(dto.input, dto.userId);

    const effectiveAmountCents = dto.amountCents ?? parsed.payableAmountCents;
    if (
      !Number.isSafeInteger(effectiveAmountCents) ||
      effectiveAmountCents <= 0 ||
      effectiveAmountCents > TRANSACTION_AMOUNT_CENTS_MAX
    ) {
      throw new InvalidTransactionError('Transaction amountCents must be a positive safe integer.');
    }

    const effectiveDate = dto.date ?? parsed.issuedDate;
    const effectiveDescription =
      dto.description !== undefined ? dto.description : parsed.issuerName.slice(0, TRANSACTION_DESCRIPTION_MAX_LENGTH);
    const effectiveStatus = dto.status ?? TransactionStatus.EFFECTIVE;

    const result = await this.dataSource.transaction(async manager => {
      const options = { manager };

      const existing = await this.fiscalNoteRepository.findActiveByUserIdAndAccessKey(
        dto.userId,
        parsed.accessKey,
        options,
      );
      if (existing) {
        throw new FiscalNoteAlreadyImportedError(existing.transactionId, existing.id);
      }

      const transaction = await this.transactionFiscalNotePort.createExpenseWithinTransaction(
        {
          userId: dto.userId,
          accountId: dto.accountId,
          categoryId: dto.categoryId,
          amountCents: effectiveAmountCents,
          date: effectiveDate,
          description: effectiveDescription,
          status: effectiveStatus,
        },
        options,
      );

      const fiscalNote = buildFiscalNoteEntityFromParsed({
        userId: dto.userId,
        transactionId: transaction.id,
        parsed,
      });

      try {
        const savedFiscalNote = await this.fiscalNoteRepository.save(fiscalNote, options);
        return {
          transaction,
          fiscalNote: savedFiscalNote,
        };
      } catch (error: unknown) {
        return handleFiscalNoteUniqueConstraintError({
          error,
          userId: dto.userId,
          transactionId: transaction.id,
          accessKey: parsed.accessKey,
          fiscalNoteRepository: this.fiscalNoteRepository,
        });
      }
    });

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.IMPORT,
    });

    return result;
  }
}
