import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';

export abstract class IFiscalNoteRepository {
  abstract findActiveByUserIdAndAccessKey(
    userId: string,
    accessKey: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null>;

  abstract findActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<FiscalNote | null>;

  abstract findActiveByTransactionIdAndUserId(
    transactionId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null>;

  abstract hasActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<boolean>;

  abstract findActiveTransactionIds(transactionIds: string[], options?: IRepositoryOptions): Promise<Set<string>>;

  abstract save(fiscalNote: FiscalNote, options?: IRepositoryOptions): Promise<FiscalNote>;

  abstract softDeleteByTransactionId(
    transactionId: string,
    userId: string,
    options: Required<IRepositoryOptions>,
  ): Promise<boolean>;
}
