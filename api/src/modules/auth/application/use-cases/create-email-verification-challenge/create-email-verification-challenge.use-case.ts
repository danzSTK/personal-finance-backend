import notificationsConfig from '@/config/notifications.config';
import {
  CreateEmailVerificationChallengeUseCaseInput,
  CreateEmailVerificationChallengeUseCaseOutput,
} from '@/modules/auth/application/use-cases/create-email-verification-challenge/create-email-verification-challenge.dto';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
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
      return this.createChallenge(input);
    }

    return await this.dataSource.transaction(manager =>
      this.createChallenge({
        ...input,
        options: { manager },
      }),
    );
  }

  private async createChallenge(
    input: CreateEmailVerificationChallengeUseCaseInput,
  ): Promise<CreateEmailVerificationChallengeUseCaseOutput> {
    const email = input.email.trim().toLowerCase();
    const now = input.now ?? new Date();

    const token = EmailVerificationToken.generate();
    const challenge = EmailVerificationChallenge.create(
      {
        userId: input.userId,
        email,
        purpose: EmailVerificationPurpose.EMAIL_VERIFICATION,
        origin: input.origin,
        tokenHash: token.hash,
        expiresAt: this.plusMinutes(now, this.notifications.emailVerificationTokenTtlMinutes),
        createdAt: now,
      },
      randomUUID(),
    );

    if (input.origin === EmailVerificationChallengeOrigin.AUTOMATIC) {
      const result = await this.challengeRepository.saveAutomaticIfAbsent(challenge, input.options);

      return {
        challenge: result.challenge,
        token: result.created ? token.value : null,
        created: result.created,
      };
    }

    const savedChallenge = await this.challengeRepository.save(challenge, input.options);

    return {
      challenge: savedChallenge,
      token: token.value,
      created: true,
    };
  }

  private plusMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }
}
