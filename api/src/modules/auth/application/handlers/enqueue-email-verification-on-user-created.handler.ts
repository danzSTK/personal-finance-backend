import { UserStatus } from '@/common/models/enums';
import { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class EnqueueEmailVerificationOnUserCreatedHandler {
  constructor(
    private readonly createChallengeUseCase: CreateEmailVerificationChallengeUseCase,
    private readonly createEmailVerificationMessageUseCase: CreateEmailVerificationMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @OnEvent(UserCreatedEvent.eventName, { suppressErrors: false })
  async handle(event: UserCreatedEvent): Promise<void> {
    if (event.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      return;
    }

    const result = await this.dataSource.transaction(async manager => {
      const challengeResult = await this.createChallengeUseCase.execute({
        userId: event.userId,
        email: event.email.value,
        mode: 'automatic',
        options: { manager },
      });

      const messageResult = await this.createEmailVerificationMessageUseCase.execute({
        userId: event.userId,
        challengeId: challengeResult.challenge.id,
        email: event.email.value,
        token: challengeResult.token,
        options: { manager },
      });

      return {
        emailMessageId: messageResult.shouldEnqueue ? (messageResult.emailMessage?.id ?? null) : null,
      };
    });

    if (!result.emailMessageId) {
      return;
    }

    await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessageId);
  }
}
