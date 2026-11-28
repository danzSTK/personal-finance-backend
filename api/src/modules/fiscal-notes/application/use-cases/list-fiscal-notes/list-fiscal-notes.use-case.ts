import {
  ListFiscalNotesInput,
  ListFiscalNotesOutput,
} from '@/modules/fiscal-notes/application/use-cases/list-fiscal-notes/list-fiscal-notes.dto';
import {
  FISCAL_NOTE_LIST_DEFAULT_LIMIT,
  FISCAL_NOTE_LIST_DEFAULT_PAGE,
  FISCAL_NOTE_LIST_DEFAULT_SORT,
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteOperations,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInvalidInputError } from '@/modules/fiscal-notes/domain/errors';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { type IMetricsRecorder, METRICS_RECORDER } from '@/shared/observability';
import { Inject, Injectable, Optional } from '@nestjs/common';

@Injectable()
export class ListFiscalNotesUseCase {
  constructor(
    private readonly fiscalNoteRepository: IFiscalNoteRepository,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
  ) {}

  async execute(input: ListFiscalNotesInput): Promise<ListFiscalNotesOutput> {
    if (input.issuedFrom && input.issuedTo && input.issuedFrom > input.issuedTo) {
      throw new FiscalNoteInvalidInputError('issuedFrom must be less than or equal to issuedTo.');
    }

    if (
      input.minAmountCents !== undefined &&
      input.maxAmountCents !== undefined &&
      input.minAmountCents > input.maxAmountCents
    ) {
      throw new FiscalNoteInvalidInputError('minAmountCents must be less than or equal to maxAmountCents.');
    }

    const page = input.page ?? FISCAL_NOTE_LIST_DEFAULT_PAGE;
    const limit = input.limit ?? FISCAL_NOTE_LIST_DEFAULT_LIMIT;
    const sort = input.sort ?? FISCAL_NOTE_LIST_DEFAULT_SORT;
    const normalizedSearch = input.search?.trim();

    const { items, total, summary } = await this.fiscalNoteRepository.list({
      userId: input.userId,
      issuedFrom: input.issuedFrom,
      issuedTo: input.issuedTo,
      issuerCnpj: input.issuerCnpj,
      sourceUf: input.sourceUf,
      minAmountCents: input.minAmountCents,
      maxAmountCents: input.maxAmountCents,
      search: normalizedSearch ? normalizedSearch : undefined,
      page,
      limit,
      sort,
    });

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.OPERATIONS_TOTAL, {
      [FiscalNoteMetricLabelKeys.OPERATION]: FiscalNoteOperations.LIST,
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1 && totalPages > 0,
      summary,
    };
  }
}
