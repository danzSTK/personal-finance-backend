import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreatePasswordChangedEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-password-changed-email-message/create-password-changed-email-message.use-case';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class EnqueuePasswordChangedEmailHandler {
  constructor(
    private readonly createEmailMessage: CreatePasswordChangedEmailMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
  ) {}

  @OnEvent(PasswordChangedEvent.eventName, {
    suppressErrors: false,
  })
  async handle(event: PasswordChangedEvent): Promise<void> {
    const result = await this.createEmailMessage.execute({
      userId: event.userId,
      sourceEventId: event.sourceEventId,
      occurredAt: event.occurredAt,
      securityContext: event.securityContext,
    });

    if (!result.shouldEnqueue) {
      return;
    }

    await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessage.id);
  }
}
