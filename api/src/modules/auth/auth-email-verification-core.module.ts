import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreateEmailVerificationChallengeUseCase } from './application/use-cases/create-email-verification-challenge/create-email-verification-challenge.use-case';
import { IEmailVerificationChallengeRepository } from './domain/repositories/email-verification-challenge.repository.interface';
import { EmailVerificationChallengeOrmEntity } from './infrastructure/persistence/email-verification-challenge-orm.entity';
import { EmailVerificationChallengeRepository } from './infrastructure/persistence/email-verification-challenge.repository';

@Module({
  imports: [TypeOrmModule.forFeature([EmailVerificationChallengeOrmEntity])],
  providers: [
    { provide: IEmailVerificationChallengeRepository, useClass: EmailVerificationChallengeRepository },
    CreateEmailVerificationChallengeUseCase,
  ],
  exports: [IEmailVerificationChallengeRepository, CreateEmailVerificationChallengeUseCase],
})
export class AuthEmailVerificationCoreModule {}
