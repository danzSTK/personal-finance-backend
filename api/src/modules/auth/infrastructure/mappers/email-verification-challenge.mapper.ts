import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { EmailVerificationChallengeOrmEntity } from '@/modules/auth/infrastructure/persistence/email-verification-challenge-orm.entity';

export class EmailVerificationChallengeMapper {
  static toDomain(entity: EmailVerificationChallengeOrmEntity): EmailVerificationChallenge {
    return EmailVerificationChallenge.reconstitute(
      {
        userId: entity.userId,
        email: entity.email,
        purpose: entity.purpose,
        origin: entity.origin,
        tokenHash: entity.tokenHash,
        expiresAt: entity.expiresAt,
        consumedAt: entity.consumedAt,
        createdAt: entity.createdAt,
      },
      entity.id,
    );
  }

  static toOrm(challenge: EmailVerificationChallenge): Partial<EmailVerificationChallengeOrmEntity> {
    return {
      id: challenge.id,
      userId: challenge.userId,
      email: challenge.email,
      purpose: challenge.purpose,
      origin: challenge.origin,
      tokenHash: challenge.tokenHash,
      expiresAt: challenge.expiresAt,
      consumedAt: challenge.consumedAt,
      createdAt: challenge.createdAt,
    };
  }
}
