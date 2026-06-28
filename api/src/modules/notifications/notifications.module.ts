import { ConfigModule } from '@/config/config.module';
import { CreateWelcomeEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-welcome-email-message/create-welcome-email-message.use-case';
import { SendEmailMessageUseCase } from '@/modules/notifications/application/use-cases/send-email-message/send-email-message.use-case';
import { EnqueueWelcomeEmailOnUserCreatedHandler } from '@/modules/notifications/application/handlers/enqueue-welcome-email-on-user-created.handler';
import { EmailJobQueue } from '@/modules/notifications/application/queues/email-job-queue.port';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { EmailMessageOrmEntity } from '@/modules/notifications/infrastructure/persistence/email-message-orm.entity';
import { EmailMessageRepository } from '@/modules/notifications/infrastructure/persistence/email-message.repository';
import { BullmqEmailJobQueue } from '@/modules/notifications/infrastructure/queues/bullmq-email-job-queue';
import { EmailMessageProcessor } from '@/modules/notifications/infrastructure/queues/email-message.processor';
import { NotificationsQueues } from '@/modules/notifications/infrastructure/queues/email-job.constants';
import { UsersModule } from '@/modules/users/users.module';
import { JobsModule } from '@/shared/jobs/jobs.module';
import { MailModule } from '@/shared/mail';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule,
    JobsModule,
    MailModule,
    UsersModule,
    TypeOrmModule.forFeature([EmailMessageOrmEntity]),
    BullModule.registerQueue({ name: NotificationsQueues.EMAIL }),
  ],
  providers: [
    {
      provide: IEmailMessageRepository,
      useClass: EmailMessageRepository,
    },
    {
      provide: EmailJobQueue,
      useClass: BullmqEmailJobQueue,
    },
    CreateWelcomeEmailMessageUseCase,
    SendEmailMessageUseCase,
    EnqueueWelcomeEmailOnUserCreatedHandler,
    EmailMessageProcessor,
  ],
})
export class NotificationsModule {}
