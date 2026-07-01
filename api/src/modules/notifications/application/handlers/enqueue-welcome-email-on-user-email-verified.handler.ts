import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreateWelcomeEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-welcome-email-message/create-welcome-email-message.use-case';
import { UserEmailVerifiedEvent } from '@/modules/users/domain/events/user-email-verified.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class EnqueueWelcomeEmailOnUserEmailVerifiedHandler {
  constructor(
    private readonly createWelcomeEmailMessageUseCase: CreateWelcomeEmailMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
  ) {}

  @OnEvent(UserEmailVerifiedEvent.eventName, { suppressErrors: false })
  async handle(event: UserEmailVerifiedEvent): Promise<void> {
    const result = await this.createWelcomeEmailMessageUseCase.execute({
      userId: event.userId,
      email: event.email.value,
    });

    if (!result.shouldEnqueue) {
      return;
    }

    await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessage.id);
  }
}
