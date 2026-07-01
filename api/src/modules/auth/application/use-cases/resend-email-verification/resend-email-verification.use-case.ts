import { UserStatus } from '@/common/models/enums';
import { EmailVerificationRequiredError } from '@/modules/auth/application/errors';
import { CreateEmailVerificationChallengeUseCase } from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import {
  ResendEmailVerificationUseCaseInput,
  ResendEmailVerificationUseCaseOutput,
} from '@/modules/auth/application/use-cases/resend-email-verification/resend-email-verification.dto';
import { CreateEmailVerificationMessageUseCase } from '@/modules/notifications/application/use-cases/create-email-verification-message/create-email-verification-message.use-case';
import { EmailJobQueueProducer } from '@/modules/notifications/application/queues/email-job-queue-producer.port';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ResendEmailVerificationUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly createChallengeUseCase: CreateEmailVerificationChallengeUseCase,
    private readonly createEmailVerificationMessageUseCase: CreateEmailVerificationMessageUseCase,
    private readonly emailJobQueueProducer: EmailJobQueueProducer,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: ResendEmailVerificationUseCaseInput): Promise<ResendEmailVerificationUseCaseOutput> {
    const result = await this.dataSource.transaction(async manager => {
      const user = await this.userRepository.findByIdForUpdate(input.userId, { manager });

      if (!user) {
        throw new EmailVerificationRequiredError();
      }

      if (user.status === UserStatus.ACTIVE) {
        return {
          status: 'ALREADY_VERIFIED' as const,
          emailMessageId: null,
        };
      }

      if (user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
        throw new EmailVerificationRequiredError();
      }

      const challengeResult = await this.createChallengeUseCase.execute({
        userId: user.id,
        email: user.email.value,
        mode: 'resend',
        options: { manager },
      });

      const messageResult = await this.createEmailVerificationMessageUseCase.execute({
        userId: user.id,
        challengeId: challengeResult.challenge.id,
        email: user.email.value,
        token: challengeResult.token,
        options: { manager },
      });

      return {
        status: 'QUEUED' as const,
        emailMessageId: messageResult.shouldEnqueue ? (messageResult.emailMessage?.id ?? null) : null,
      };
    });

    if (result.emailMessageId) {
      await this.emailJobQueueProducer.enqueueEmailMessage(result.emailMessageId);
    }

    return { status: result.status };
  }
}
