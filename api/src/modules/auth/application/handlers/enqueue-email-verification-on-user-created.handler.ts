import { UserStatus } from '@/common/models/enums';
import { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  EMAIL_VERIFICATION_MINIMUM_USABLE_TOKEN_SECONDS,
  EmailVerificationChallengeOrigin,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { IEmailVerificationResendStateStore } from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';
import { Logger } from '@nestjs/common';

@Injectable()
export class EnqueueEmailVerificationOnUserCreatedHandler {
  private readonly logger = new Logger(EnqueueEmailVerificationOnUserCreatedHandler.name);

  constructor(
    private readonly createChallengeUseCase: CreateEmailVerificationChallengeUseCase,
    private readonly createEmailVerificationMessageUseCase: CreateEmailVerificationMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
    private readonly resendStateStore: IEmailVerificationResendStateStore,
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
        origin: EmailVerificationChallengeOrigin.AUTOMATIC,
        options: { manager },
      });

      const messageResult = await this.createEmailVerificationMessageUseCase.execute({
        userId: event.userId,
        challengeId: challengeResult.challenge.id,
        email: event.email.value,
        token: challengeResult.token,
        deliverBefore: new Date(
          challengeResult.challenge.expiresAt.getTime() - EMAIL_VERIFICATION_MINIMUM_USABLE_TOKEN_SECONDS * 1_000,
        ),
        options: { manager },
      });

      return {
        challengeId: challengeResult.challenge.id,
        logicalSendAt: challengeResult.challenge.createdAt,
        emailMessageId: messageResult.shouldEnqueue ? (messageResult.emailMessage?.id ?? null) : null,
      };
    });

    try {
      await this.resendStateStore.completeLogicalSend({
        userId: event.userId,
        origin: EmailVerificationChallengeOrigin.AUTOMATIC,
        challengeId: result.challengeId,
        logicalSendAt: result.logicalSendAt,
        now: new Date(),
      });
    } catch {
      this.logger.warn('Automatic email verification was committed but Redis cooldown registration failed.');
    }

    if (!result.emailMessageId) {
      return;
    }

    await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessageId);
  }
}
