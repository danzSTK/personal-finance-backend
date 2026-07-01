import { UserStatus } from '@/common/models/enums';
import {
  EmailVerificationTokenExpiredError,
  EmailVerificationTokenInvalidError,
  EmailVerificationUserBlockedError,
} from '@/modules/auth/application/errors';
import {
  ConfirmEmailVerificationUseCaseInput,
  ConfirmEmailVerificationUseCaseOutput,
} from '@/modules/auth/application/use-cases/confirm-email-verification/confirm-email-verification.dto';
import { EmailVerificationPurpose } from '@/modules/auth/domain/constants/email-verification.constants';
import { IEmailVerificationChallengeRepository } from '@/modules/auth/domain/repositories/email-verification-challenge.repository.interface';
import { EmailVerificationToken } from '@/modules/auth/domain/value-objects/email-verification-token.value-object';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ConfirmEmailVerificationUseCase {
  constructor(
    private readonly challengeRepository: IEmailVerificationChallengeRepository,
    private readonly userRepository: IUserRepository,
    private readonly outboxWriteService: OutboxWriteService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: ConfirmEmailVerificationUseCaseInput): Promise<ConfirmEmailVerificationUseCaseOutput> {
    const tokenHash = EmailVerificationToken.hash(input.token.trim());

    return await this.dataSource.transaction(async manager => {
      const challenge = await this.challengeRepository.findByTokenHashForUpdate(
        EmailVerificationPurpose.EMAIL_VERIFICATION,
        tokenHash,
        { manager },
      );

      if (!challenge) {
        throw new EmailVerificationTokenInvalidError();
      }

      const user = await this.userRepository.findByIdForUpdate(challenge.userId, { manager });

      if (!user) {
        throw new EmailVerificationTokenInvalidError();
      }

      if (user.status === UserStatus.BLOCKED) {
        throw new EmailVerificationUserBlockedError();
      }

      if (challenge.isConsumed) {
        if (user.status === UserStatus.ACTIVE) {
          return { status: 'VERIFIED' };
        }

        throw new EmailVerificationTokenInvalidError();
      }

      if (challenge.isExpired()) {
        throw new EmailVerificationTokenExpiredError();
      }

      challenge.consume();

      if (user.status === UserStatus.PENDING_EMAIL_VERIFICATION) {
        user.markEmailVerified();
        const domainEvents = user.pullDomainEvents();

        await this.userRepository.save(user, { manager });
        await this.outboxWriteService.storeEvents(domainEvents, { manager });
      }

      await this.challengeRepository.save(challenge, { manager });

      return { status: 'VERIFIED' };
    });
  }
}
