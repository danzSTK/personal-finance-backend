import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { FiscalNoteTransactionLifecyclePort } from '@/modules/fiscal-notes/application/ports';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { Injectable } from '@nestjs/common';

@Injectable()
export class FiscalNoteTransactionLifecycleAdapter extends FiscalNoteTransactionLifecyclePort {
  constructor(private readonly fiscalNoteRepository: IFiscalNoteRepository) {
    super();
  }

  hasActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<boolean> {
    return this.fiscalNoteRepository.hasActiveByTransactionId(transactionId, options);
  }

  findActiveTransactionIds(transactionIds: string[], options?: IRepositoryOptions): Promise<Set<string>> {
    return this.fiscalNoteRepository.findActiveTransactionIds(transactionIds, options);
  }

  softDeleteByTransactionId(
    transactionId: string,
    userId: string,
    options: Required<IRepositoryOptions>,
  ): Promise<boolean> {
    return this.fiscalNoteRepository.softDeleteByTransactionId(transactionId, userId, options);
  }
}
