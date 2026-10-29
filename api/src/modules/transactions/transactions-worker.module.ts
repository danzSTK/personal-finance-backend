import { AssetsCoreModule } from '@/modules/assets/assets-core.module';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { BullmqTransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/bullmq-transaction-attachment-job-queue-producer';
import { TransactionAttachmentJobQueueProducer } from '@/modules/transactions/infrastructure/queues/transaction-attachment-job-queue-producer.port';
import { TransactionAttachmentOptimizationProcessor } from '@/modules/transactions/infrastructure/queues/transaction-attachment-optimization.processor';
import { TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE } from '@/modules/transactions/infrastructure/queues/transaction-attachment-queue.constants';
import { TransactionAttachmentOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-attachment-orm.entity';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { ObjectStorageModule } from '@/shared/object-storage/object-storage.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRANSACTION_ATTACHMENTS_OPTIMIZATION_QUEUE }),
    AssetsCoreModule,
    ObjectStorageModule,
    TypeOrmModule.forFeature([AssetOrmEntity, TransactionOrmEntity, TransactionAttachmentOrmEntity]),
  ],
  providers: [
    TransactionAttachmentOptimizationProcessor,
    {
      provide: TransactionAttachmentJobQueueProducer,
      useClass: BullmqTransactionAttachmentJobQueueProducer,
    },
  ],
  exports: [BullModule, TransactionAttachmentJobQueueProducer],
})
export class TransactionsWorkerModule {}
