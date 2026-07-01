import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailVerificationPurpose } from '@/modules/auth/domain/constants/email-verification.constants';
import { EmailVerificationChallenge } from '@/modules/auth/domain/entities/email-verification-challenge.entity';
import { IEmailVerificationChallengeRepository } from '@/modules/auth/domain/repositories/email-verification-challenge.repository.interface';
import { EmailVerificationChallengeMapper } from '@/modules/auth/infrastructure/mappers/email-verification-challenge.mapper';
import { EmailVerificationChallengeOrmEntity } from '@/modules/auth/infrastructure/persistence/email-verification-challenge-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';

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

  async findLatestByEmailAndPurpose(
    email: string,
    purpose: EmailVerificationPurpose,
    options?: IRepositoryOptions,
  ): Promise<EmailVerificationChallenge | null> {
    const repository = this.getRepository(options);
    const challenge = await repository.findOne({
      where: { email, purpose },
      order: { createdAt: 'DESC' },
    });

    return challenge ? EmailVerificationChallengeMapper.toDomain(challenge) : null;
  }

  async countByEmailAndPurposeSince(
    email: string,
    purpose: EmailVerificationPurpose,
    since: Date,
    options?: IRepositoryOptions,
  ): Promise<number> {
    const repository = this.getRepository(options);

    return await repository.count({
      where: {
        email,
        purpose,
        createdAt: MoreThanOrEqual(since),
      },
    });
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
