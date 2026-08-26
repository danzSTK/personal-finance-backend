import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import {
  EmailVerificationChallengeOrigin,
  EmailVerificationPurpose,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { IEmailVerificationChallengeRepository } from '@/modules/auth/domain/repositories/email-verification-challenge.repository.interface';
import { EmailVerificationChallengeMapper } from '@/modules/auth/infrastructure/mappers/email-verification-challenge.mapper';
import { EmailVerificationChallengeOrmEntity } from '@/modules/auth/infrastructure/persistence/email-verification-challenge-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmailVerificationChallengeRepository implements IEmailVerificationChallengeRepository {
  constructor(
    @InjectRepository(EmailVerificationChallengeOrmEntity)
    private readonly repository: Repository<EmailVerificationChallengeOrmEntity>,
  ) {}

  async findByTokenHash(
    purpose: EmailVerificationPurpose,
    tokenHash: string,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge | null> {
    const repository = this.getRepository(options);
    const challenge = await repository.findOne({ where: { purpose, tokenHash } });

    return challenge ? EmailVerificationChallengeMapper.toDomain(challenge) : null;
  }

  async findByTokenHashForUpdate(
    purpose: EmailVerificationPurpose,
    tokenHash: string,
    options: Required<IRepositoryOptions>,
  ): Promise<EmailVerificationChallenge | null> {
    const repository = this.getRepository(options);
    const challenge = await repository.findOne({
      where: { purpose, tokenHash },
      lock: { mode: 'pessimistic_write' },
    });

    return challenge ? EmailVerificationChallengeMapper.toDomain(challenge) : null;
  }

  async findByUserIdPurposeAndOrigin(
    userId: string,
    purpose: EmailVerificationPurpose,
    origin: EmailVerificationChallengeOrigin,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge | null> {
    const repository = this.getRepository(options);
    const challenge = await repository.findOne({
      where: { userId, purpose, origin },
    });

    return challenge ? EmailVerificationChallengeMapper.toDomain(challenge) : null;
  }

  async saveAutomaticIfAbsent(
    challenge: EmailVerificationChallenge,
    options?: IRepositoryOptions,
  ): Promise<{ challenge: EmailVerificationChallenge; created: boolean }> {
    const repository = this.getRepository(options);
    const result = await repository
      .createQueryBuilder()
      .insert()
      .into(EmailVerificationChallengeOrmEntity)
      .values({
        id: challenge.id,
        userId: challenge.userId,
        email: challenge.email,
        purpose: challenge.purpose,
        origin: challenge.origin,
        tokenHash: challenge.tokenHash,
        expiresAt: challenge.expiresAt,
        consumedAt: challenge.consumedAt,
        createdAt: challenge.createdAt,
      })
      .orIgnore()
      .returning('*')
      .execute();
    const insertedRows = result.raw as unknown[];

    if (insertedRows.length > 0) {
      const inserted = await repository.findOne({ where: { id: challenge.id } });

      if (!inserted) {
        throw new Error('Automatic email verification challenge not found after insert.');
      }

      return { challenge: EmailVerificationChallengeMapper.toDomain(inserted), created: true };
    }

    const existing = await this.findByUserIdPurposeAndOrigin(
      challenge.userId,
      challenge.purpose,
      EmailVerificationChallengeOrigin.AUTOMATIC,
      options,
    );

    if (!existing) {
      throw new Error('Automatic email verification challenge conflict could not be resolved.');
    }

    return { challenge: existing, created: false };
  }

  async save(challenge: EmailVerificationChallenge, options?: IRepositoryOptions): Promise<EmailVerificationChallenge> {
    const repository = this.getRepository(options);
    await repository.save(EmailVerificationChallengeMapper.toOrm(challenge));

    const saved = await repository.findOne({ where: { id: challenge.id } });

    if (!saved) {
      throw new Error('Email verification challenge not found after save.');
    }

    return EmailVerificationChallengeMapper.toDomain(saved);
  }

  private getRepository(options?: IRepositoryOptions): Repository<EmailVerificationChallengeOrmEntity> {
    return options?.manager ? options.manager.getRepository(EmailVerificationChallengeOrmEntity) : this.repository;
  }
}
