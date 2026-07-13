import { ConfigModule } from '@/config/config.module';
import { UsersPersistenceModule } from '@/modules/users/users-persistence.module';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EmailJobQueueProducer } from './application/queues/email-job-queue-producer.port';
import { CreateEmailVerificationMessageUseCase } from './application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import { CreateWelcomeEmailMessageUseCase } from './application/use-cases/create-welcome-email-message/create-welcome-email-message.use-case';
import { BullmqEmailJobQueueProducer } from './infrastructure/queues/bullmq-email-job-queue-producer';
import { NotificationsQueues } from './infrastructure/queues/email-job.constants';
import { NotificationsPersistenceModule } from './notifications-persistence.module';

@Module({
  imports: [
    ConfigModule,
    JobsModule,
    UsersPersistenceModule,
    NotificationsPersistenceModule,
    BullModule.registerQueue({ name: NotificationsQueues.EMAIL }),
  ],
  providers: [
    { provide: EmailJobQueueProducer, useClass: BullmqEmailJobQueueProducer },
    CreateEmailVerificationMessageUseCase,
    CreateWelcomeEmailMessageUseCase,
  ],
  exports: [
    NotificationsPersistenceModule,
    EmailJobQueueProducer,
    CreateEmailVerificationMessageUseCase,
    CreateWelcomeEmailMessageUseCase,
    BullModule,
  ],
})
export class NotificationsProducerModule {}
