import { UserStatus } from '@/common/models/enums';
import {
  EmailVerificationCooldownActiveError,
  EmailVerificationDailyLimitExceededError,
  EmailVerificationOperationPendingError,
  EmailVerificationRequiredError,
  EmailVerificationStateUnavailableError,
} from '@/modules/auth/application/errors';
import { IEmailVerificationResendStateStore } from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';
import { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import {
  ResendEmailVerificationUseCaseInput,
  ResendEmailVerificationUseCaseOutput,
} from '@/modules/auth/application/use-cases/resend-email-verification/resend-email-verification.dto';
import {
  EMAIL_VERIFICATION_MINIMUM_USABLE_TOKEN_SECONDS,
  EmailVerificationChallengeOrigin,
  EmailVerificationResendRestriction,
  EmailVerificationResendMutationKind,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

type ResendTransactionResult =
  | { readonly status: typeof EmailVerificationResendStatus.ALREADY_VERIFIED }
  | {
      readonly status: typeof EmailVerificationResendStatus.QUEUED;
      readonly challengeId: string;
      readonly logicalSendAt: Date;
      readonly emailMessageId: string | null;
    };

@Injectable()
export class ResendEmailVerificationUseCase {
  private readonly logger = new Logger(ResendEmailVerificationUseCase.name);

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly createChallengeUseCase: CreateEmailVerificationChallengeUseCase,
    private readonly createEmailVerificationMessageUseCase: CreateEmailVerificationMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
    private readonly resendStateStore: IEmailVerificationResendStateStore,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: ResendEmailVerificationUseCaseInput): Promise<ResendEmailVerificationUseCaseOutput> {
    const currentUser = await this.userRepository.findById(input.userId);

    if (!currentUser) {
      throw new EmailVerificationRequiredError();
    }

    if (currentUser.status === UserStatus.ACTIVE) {
      return { status: EmailVerificationResendStatus.ALREADY_VERIFIED };
    }

    if (currentUser.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      throw new EmailVerificationRequiredError();
    }

    const mutationToken = randomUUID();
    const now = new Date();
    const mutation = await this.beginMutation(input.userId, mutationToken, now);

    if (mutation.kind === EmailVerificationResendMutationKind.BLOCKED) {
      this.throwRestriction(mutation.blockedBy, mutation.retryAfterSeconds);
    }

    let result: ResendTransactionResult;
    try {
      result = await this.dataSource.transaction(async manager => {
        const user = await this.userRepository.findByIdForUpdate(input.userId, { manager });

        if (!user) {
          throw new EmailVerificationRequiredError();
        }

        if (user.status === UserStatus.ACTIVE) {
          return { status: EmailVerificationResendStatus.ALREADY_VERIFIED };
        }

        if (user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
          throw new EmailVerificationRequiredError();
        }

        const challengeResult = await this.createChallengeUseCase.execute({
          userId: user.id,
          email: user.email.value,
          origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
          now,
          options: { manager },
        });

        const messageResult = await this.createEmailVerificationMessageUseCase.execute({
          userId: user.id,
          challengeId: challengeResult.challenge.id,
          email: user.email.value,
          token: challengeResult.token,
          deliverBefore: this.deliveryDeadline(challengeResult.challenge.expiresAt),
          options: { manager },
        });

        return {
          status: EmailVerificationResendStatus.QUEUED,
          challengeId: challengeResult.challenge.id,
          logicalSendAt: challengeResult.challenge.createdAt,
          emailMessageId: messageResult.shouldEnqueue ? (messageResult.emailMessage?.id ?? null) : null,
        };
      });
    } catch (error) {
      await this.abortMutation(input.userId, mutationToken);
      throw error;
    }

    if (result.status === EmailVerificationResendStatus.ALREADY_VERIFIED) {
      await this.abortMutation(input.userId, mutationToken);

      return { status: EmailVerificationResendStatus.ALREADY_VERIFIED };
    }

    try {
      await this.resendStateStore.completeLogicalSend({
        userId: input.userId,
        origin: EmailVerificationChallengeOrigin.MANUAL_RESEND,
        challengeId: result.challengeId,
        logicalSendAt: result.logicalSendAt,
        now: new Date(),
        mutationToken,
      });
    } catch {
      this.logger.warn('Email verification resend was committed but Redis state completion failed.');
    }

    if (result.emailMessageId) {
      try {
        await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessageId);
      } catch {
        this.logger.warn(
          'Email verification resend was committed but immediate enqueue failed; reconciliation will retry.',
        );
      }
    }

    return { status: result.status };
  }

  private async beginMutation(userId: string, mutationToken: string, now: Date) {
    try {
      return await this.resendStateStore.beginMutation(userId, mutationToken, now);
    } catch {
      throw new EmailVerificationStateUnavailableError();
    }
  }

  private async abortMutation(userId: string, mutationToken: string): Promise<void> {
    try {
      await this.resendStateStore.abortMutation(userId, mutationToken);
    } catch {
      this.logger.warn('Email verification resend mutation could not be released; TTL will recover it.');
    }
  }

  private throwRestriction(restriction: EmailVerificationResendRestriction, retryAfterSeconds: number): never {
    switch (restriction) {
      case EmailVerificationResendRestriction.COOLDOWN:
        throw new EmailVerificationCooldownActiveError(retryAfterSeconds);
      case EmailVerificationResendRestriction.DAILY_LIMIT:
        throw new EmailVerificationDailyLimitExceededError(retryAfterSeconds);
      case EmailVerificationResendRestriction.OPERATION_PENDING:
        throw new EmailVerificationOperationPendingError(retryAfterSeconds);
    }
  }

  private deliveryDeadline(expiresAt: Date): Date {
    return new Date(expiresAt.getTime() - EMAIL_VERIFICATION_MINIMUM_USABLE_TOKEN_SECONDS * 1_000);
  }
}
