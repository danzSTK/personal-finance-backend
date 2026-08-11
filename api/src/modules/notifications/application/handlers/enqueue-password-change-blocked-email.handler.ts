import { PasswordChangeBlockStartedEvent } from '@/modules/auth/domain/events/password-change-block-started.event';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreatePasswordChangeBlockedEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-password-change-blocked-email-message/create-password-change-blocked-email-message.use-case';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class EnqueuePasswordChangeBlockedEmailHandler {
  constructor(
    private readonly createEmailMessage: CreatePasswordChangeBlockedEmailMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
  ) {}

  @OnEvent(PasswordChangeBlockStartedEvent.eventName, {
    suppressErrors: false,
  })
  async handle(event: PasswordChangeBlockStartedEvent): Promise<void> {
    const result = await this.createEmailMessage.execute({
      userId: event.userId,
      sourceEventId: event.sourceEventId,
      blockedUntil: event.blockedUntil,
      securityContext: event.securityContext,
    });

    if (!result.shouldEnqueue) {
      return;
    }

    await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessage.id);
  }
}
