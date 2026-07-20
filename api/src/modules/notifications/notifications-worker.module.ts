import { MailModule } from '@/shared/mail';
import { Module } from '@nestjs/common';
import { SendEmailMessageUseCase } from './application/use-cases/send-email-message/send-email-message.use-case';
import { EmailMessageProcessor } from './infrastructure/queues/email-message.processor';
import { EmailMessageEnqueueReconciler } from './infrastructure/queues/email-message-enqueue-reconciler.service';
import { NotificationsProducerModule } from './notifications-producer.module';

@Module({
  imports: [NotificationsProducerModule, MailModule],
  providers: [SendEmailMessageUseCase, EmailMessageProcessor, EmailMessageEnqueueReconciler],
})
export class NotificationsWorkerModule {}
