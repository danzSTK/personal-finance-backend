import { CreateWelcomeEmailMessageUseCase } from '@/modules/notifications/application/use-cases/create-welcome-email-message/create-welcome-email-message.use-case';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class EnqueueWelcomeEmailOnUserCreatedHandler {
  constructor(
    private readonly createWelcomeEmailMessageUseCase: CreateWelcomeEmailMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
  ) {}

  @OnEvent(UserCreatedEvent.eventName, { suppressErrors: false })
  async handle(event: UserCreatedEvent): Promise<void> {
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
