import { FiscalNoteTransactionLifecyclePort } from '@/modules/fiscal-notes/application/ports';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import {
  GetTransactionUseCaseInput,
  GetTransactionUseCaseOutput,
} from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.dto';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
    private readonly fiscalNoteLifecyclePort: FiscalNoteTransactionLifecyclePort,
  ) {}
  async execute(input: GetTransactionUseCaseInput): Promise<GetTransactionUseCaseOutput> {
    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    const [attachmentsCount, hasFiscalNote] = await Promise.all([
      this.attachmentRepository.countActiveByTransactionId(input.transactionId),
      this.fiscalNoteLifecyclePort.hasActiveByTransactionId(input.transactionId),
    ]);
    transaction.setAttachmentsCount(attachmentsCount);
    transaction.setHasFiscalNote(hasFiscalNote);

    return transaction;
  }
}
