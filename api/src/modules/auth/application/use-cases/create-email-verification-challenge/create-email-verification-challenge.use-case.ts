import notificationsConfig from '@/config/notifications.config';
import {
  EmailVerificationCooldownActiveError,
  EmailVerificationDailyLimitExceededError,
} from '@/modules/auth/application/errors';
import {
  CreateEmailVerificationChallengeUseCaseInput,
  CreateEmailVerificationChallengeUseCaseOutput,
} from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.dto';
import { EmailVerificationPurpose } from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { IEmailVerificationChallengeRepository } from '@/modules/auth/domain/repositories/email-verification-challenge.repository.interface';
import { EmailVerificationToken } from '@/modules/auth/domain/value-objects/email-verification-token.value-object';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

@Injectable()
export class CreateEmailVerificationChallengeUseCase {
  constructor(
    private readonly challengeRepository: IEmailVerificationChallengeRepository,
    @Inject(notificationsConfig.KEY)
    private readonly notifications: ConfigType<typeof notificationsConfig>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(
    input: CreateEmailVerificationChallengeUseCaseInput,
  ): Promise<CreateEmailVerificationChallengeUseCaseOutput> {
    if (input.options?.manager) {
      return this.executeWithPolicy(input);
    }

    return await this.dataSource.transaction(manager =>
      this.executeWithPolicy({
        ...input,
        options: { manager },
      }),
    );
  }

  private async executeWithPolicy(
    input: CreateEmailVerificationChallengeUseCaseInput,
  ): Promise<CreateEmailVerificationChallengeUseCaseOutput> {
    const email = input.email.trim().toLowerCase();
    const now = new Date();
    const latest = await this.challengeRepository.findLatestByEmailAndPurpose(
      email,
      EmailVerificationPurpose.EMAIL_VERIFICATION,
      input.options,
    );

    if (latest && this.isWithinCooldown(latest.createdAt, now)) {
      if (input.mode === 'automatic') {
        return {
          challenge: latest,
          token: null,
          created: false,
        };
      }

      throw new EmailVerificationCooldownActiveError();
    }

    const dailyCount = await this.challengeRepository.countByEmailAndPurposeSince(
      email,
      EmailVerificationPurpose.EMAIL_VERIFICATION,
      this.minusHours(now, 24),
      input.options,
    );

    if (dailyCount >= this.notifications.emailVerificationDailyLimit) {
      if (input.mode === 'automatic' && latest) {
        return {
          challenge: latest,
          token: null,
          created: false,
        };
      }

      throw new EmailVerificationDailyLimitExceededError();
    }

    const token = EmailVerificationToken.generate();
    const challenge = EmailVerificationChallenge.create(
      {
        userId: input.userId,
        email,
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
        tokenHash: token.hash,
        expiresAt: this.plusMinutes(now, this.notifications.emailVerificationTokenTtlMinutes),
      },
      randomUUID(),
    );

    const savedChallenge = await this.challengeRepository.save(challenge, input.options);

    return {
      challenge: savedChallenge,
      token: token.value,
      created: true,
    };
  }

  private isWithinCooldown(createdAt: Date, now: Date): boolean {
    const cooldownMs = this.notifications.emailVerificationResendCooldownMinutes * 60 * 1000;

    return now.getTime() - createdAt.getTime() < cooldownMs;
  }

  private plusMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private minusHours(date: Date, hours: number): Date {
    return new Date(date.getTime() - hours * 60 * 60 * 1000);
  }
}
