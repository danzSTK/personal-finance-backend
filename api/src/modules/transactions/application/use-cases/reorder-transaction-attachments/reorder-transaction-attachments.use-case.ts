import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { ReorderTransactionAttachmentsInput } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.dto';
import { InvalidAttachmentPositionError } from '@/modules/transactions/domain/errors';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReorderTransactionAttachmentsUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly transactionRepository: ITransactionRepository,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
  ) {}

  async execute(input: ReorderTransactionAttachmentsInput): Promise<void> {
    if (!input.positions || input.positions.length === 0) {
      return;
    }

    await this.dataSource.transaction(async manager => {
      const transaction = await this.transactionRepository.findByIdAndUserIdForUpdate(
        input.transactionId,
        input.userId,
        { manager },
      );

      if (!transaction) {
        throw new TransactionNotFoundError();
      }

      await this.attachmentRepository.deleteInactiveByTransactionId(input.transactionId, { manager });

      const existing = await this.attachmentRepository.findByTransactionId(input.transactionId, { manager });

      if (input.positions.length !== existing.length) {
        throw new InvalidAttachmentPositionError('Positions must include all attachments of the transaction.');
      }

      const existingIds = new Set(existing.map(item => item.id));
      const seenIds = new Set<string>();
      const assignedPositions = new Set<number>();

      for (const item of input.positions) {
        if (!existingIds.has(item.id)) {
          throw new InvalidAttachmentPositionError(`Attachment ${item.id} does not belong to the transaction.`);
        }

        if (seenIds.has(item.id)) {
          throw new InvalidAttachmentPositionError(`Duplicate attachment ID ${item.id} detected.`);
        }

        if (!Number.isInteger(item.position) || item.position < 0 || item.position >= existing.length) {
          throw new InvalidAttachmentPositionError('Attachment positions must be integers from 0 to N-1.');
        }

        if (assignedPositions.has(item.position)) {
          throw new InvalidAttachmentPositionError('Duplicate attachment position detected.');
        }

        seenIds.add(item.id);
        assignedPositions.add(item.position);
      }

      await this.attachmentRepository.reorderPositions(input.transactionId, input.positions, { manager });
    });
  }
}
