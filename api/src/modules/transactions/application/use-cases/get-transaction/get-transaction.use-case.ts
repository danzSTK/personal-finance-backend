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
  ) {}
  async execute(input: GetTransactionUseCaseInput): Promise<GetTransactionUseCaseOutput> {
    const transaction = await this.transactionRepository.findByIdAndUserId(input.transactionId, input.userId);

    if (!transaction) {
      throw new TransactionNotFoundError();
    }

    const attachmentsCount = await this.attachmentRepository.countActiveByTransactionId(input.transactionId);
    transaction.setAttachmentsCount(attachmentsCount);

    return transaction;
  }
}
