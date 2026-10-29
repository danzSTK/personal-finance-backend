import { AccountsModule } from '@/modules/accounts/accounts.module';
import { AssetsCoreModule } from '@/modules/assets/assets-core.module';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { TransactionReferenceValidator } from '@/modules/transactions/application/services/transaction-reference-validator.service';
import { AddTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/add-transaction-attachments/add-transaction-attachments.use-case';
import { ConfirmTransactionUseCase } from '@/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.use-case';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { DeleteTransactionAttachmentUseCase } from '@/modules/transactions/application/use-cases/delete-transaction-attachment/delete-transaction-attachment.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case';
import { GetTransactionUseCase } from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.use-case';
import { ListTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/list-transaction-attachments/list-transaction-attachments.use-case';
import { ListTransactionsUseCase } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.use-case';
import { ReorderTransactionAttachmentsUseCase } from '@/modules/transactions/application/use-cases/reorder-transaction-attachments/reorder-transaction-attachments.use-case';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case';
import { ITransactionAttachmentRepository } from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { ITransactionRepository } from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { TransactionAttachmentImageValidator } from '@/modules/transactions/infrastructure/image-processing/transaction-attachment-image.validator';
import { TransactionAttachmentOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-attachment-orm.entity';
import { TransactionAttachmentRepository } from '@/modules/transactions/infrastructure/persistence/transaction-attachment.repository';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { TransactionRepository } from '@/modules/transactions/infrastructure/persistence/transaction.repository';
import { BullmqTransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/bullmq-transaction-attachment-job-queue-producer';
import { TransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/transaction-attachment-job-queue-producer.port';
import { TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE } from '@/modules/transactions/infrastructure/queues/transaction-attachment-queue.constants';
import { TransactionAttachmentsController } from '@/modules/transactions/presentation/http/transaction-attachments.controller';
import { TransactionsController } from '@/modules/transactions/presentation/http/transactions.controller';
import { ObjectStorageModule } from '@/shared/object-storage/object-storage.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionOrmEntity, TransactionAttachmentOrmEntity]),
    BullModule.registerQueue({ name: TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE }),
    AccountsModule,
    CategoriesModule,
    AssetsCoreModule,
    ObjectStorageModule,
  ],
  controllers: [TransactionsController, TransactionAttachmentsController],
  providers: [
    {
      provide: ITransactionRepository,
      useClass: TransactionRepository,
    },
    {
      provide: ITransactionAttachmentRepository,
      useClass: TransactionAttachmentRepository,
    },
    {
      provide: TransactionAttachmentJobQueueProducer,
      useClass: BullmqTransactionAttachmentJobQueueProducer,
    },
    TransactionReferenceValidator,
    TransactionAttachmentImageValidator,
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    UpdateTransactionUseCase,
    ConfirmTransactionUseCase,
    DeleteTransactionUseCase,
    AddTransactionAttachmentsUseCase,
    ListTransactionAttachmentsUseCase,
    DeleteTransactionAttachmentUseCase,
    ReorderTransactionAttachmentsUseCase,
  ],
  exports: [
    ITransactionRepository,
    ITransactionAttachmentRepository,
    TransactionAttachmentJobQueueProducer,
    CreateTransactionUseCase,
    ListTransactionsUseCase,
    GetTransactionUseCase,
    UpdateTransactionUseCase,
    ConfirmTransactionUseCase,
    DeleteTransactionUseCase,
    AddTransactionAttachmentsUseCase,
    ListTransactionAttachmentsUseCase,
    DeleteTransactionAttachmentUseCase,
    ReorderTransactionAttachmentsUseCase,
  ],
})
export class TransactionsModule {}
