import { InvalidAttachmentPositionError } from '@/modules/transactions/domain/errors';
import { TransactionNotFoundError } from '@/modules/transactions/application/errors';
import { ReorderTransactionAttachmentsInput } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.dto';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReorderTransactionAttachmentsUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly attachmentRepository: ITransactionAttachmentRepository,
  ) {}

  async execute(input: ReorderTransactionAttachmentsInput): Promise<void> {
    if (!input.positions || input.positions.length === 0) {
      return;
    }

    await this.dataSource.transaction(async manager => {
      const tx = await manager.findOne(TransactionOrmEntity, {
        where: { id: input.transactionId, user_id: input.userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!tx || tx.deleted_at !== null) {
        throw new TransactionNotFoundError();
      }

      const existing = await this.attachmentRepository.findByTransactionId(input.transactionId, { manager });

      if (input.positions.length !== existing.length) {
        throw new InvalidAttachmentPositionError('Positions must include all attachments of the transaction.');
      }

      const existingIds: Record<string, true> = {};
      existing.forEach(item => {
        existingIds[item.id] = true;
      });

      const assignedPositions: Record<number, true> = {};

      for (const item of input.positions) {
        if (!existingIds[item.id]) {
          throw new InvalidAttachmentPositionError(`Attachment ${item.id} does not belong to the transaction.`);
        }

        if (!Number.isInteger(item.position) || item.position < 0 || item.position >= existing.length) {
          throw new InvalidAttachmentPositionError('Attachment positions must be integers from 0 to N-1.');
        }

        if (assignedPositions[item.position]) {
          throw new InvalidAttachmentPositionError('Duplicate attachment position detected.');
        }

        assignedPositions[item.position] = true;
      }

      await this.attachmentRepository.reorderPositions(input.transactionId, input.positions, { manager });
    });
  }
}
