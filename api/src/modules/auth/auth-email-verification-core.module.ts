import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateEmailVerificationChallengeUseCase } from './application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import { IEmailVerificationChallengeRepository } from './domain/repositories/email-verification-challenge.repository.interface';
import { EmailVerificationChallengeOrmEntity } from './infrastructure/persistence/email-verification-challenge-orm.entity';
import { EmailVerificationChallengeRepository } from './infrastructure/persistence/email-verification-challenge.repository';
import { IEmailVerificationResendStateStore } from './application/ports/email-verification-resend-state-store.interface';
import { RedisEmailVerificationResendStateStore } from './infrastructure/cache/redis-email-verification-resend-state-store';

@Module({
  imports: [TypeOrmModule.forFeature([EmailVerificationChallengeOrmEntity])],
  providers: [
    { provide: IEmailVerificationChallengeRepository, useClass: EmailVerificationChallengeRepository },
    { provide: IEmailVerificationResendStateStore, useClass: RedisEmailVerificationResendStateStore },
    CreateEmailVerificationChallengeUseCase,
  ],
  exports: [
    IEmailVerificationChallengeRepository,
    IEmailVerificationResendStateStore,
    CreateEmailVerificationChallengeUseCase,
  ],
})
export class AuthEmailVerificationCoreModule {}
