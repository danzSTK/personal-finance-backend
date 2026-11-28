import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';

export abstract class FiscalNoteTransactionLifecyclePort {
  abstract hasActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<boolean>;

  abstract findActiveTransactionIds(transactionIds: string[], options?: IRepositoryOptions): Promise<Set<string>>;

  abstract softDeleteByTransactionId(
    transactionId: string,
    userId: string,
    options: Required<IRepositoryOptions>,
  ): Promise<boolean>;
}
