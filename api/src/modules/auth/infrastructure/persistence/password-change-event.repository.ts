import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { PasswordChangeEventType } from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';
import { IPasswordChangeEventRepository } from '@/modules/auth/domain/repositories/password-change-event.repository.interface';
import { PasswordChangeEventMapper } from '@/modules/auth/infrastructure/mappers/password-change-event.mapper';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, MoreThanOrEqual, Repository } from 'typeorm';

@Injectable()
export class PasswordChangeEventRepository implements IPasswordChangeEventRepository {
  constructor(
    @InjectRepository(PasswordChangeEventOrmEntity)
    private readonly repository: Repository<PasswordChangeEventOrmEntity>,
  ) {}

  async findRelevantEvents(userId: string, since: Date, options?: IRepositoryOptions): Promise<PasswordChangeEvent[]> {
    const repository = this.getRepository(options);
    const events = await repository.find({
      where: {
        userId,
        occurredAt: MoreThanOrEqual(since),
      },
      order: {
        occurredAt: 'DESC',
        createdAt: 'DESC',
      },
    });

    return events.map(event => PasswordChangeEventMapper.toDomain(event));
  }

  async findActiveBlock(userId: string, at: Date, options?: IRepositoryOptions): Promise<PasswordChangeEvent | null> {
    const repository = this.getRepository(options);
    const event = await repository.findOne({
      where: {
        userId,
        eventType: PasswordChangeEventType.FAILED_ATTEMPTS_BLOCK_STARTED,
        blockedUntil: MoreThan(at),
      },
      order: {
        blockedUntil: 'DESC',
        occurredAt: 'DESC',
      },
    });

    return event ? PasswordChangeEventMapper.toDomain(event) : null;
  }

  async save(event: PasswordChangeEvent, options?: IRepositoryOptions): Promise<PasswordChangeEvent> {
    const repository = this.getRepository(options);
    const persistence = repository.create(PasswordChangeEventMapper.toPersistence(event));
    const saved = await repository.save(persistence);

    return PasswordChangeEventMapper.toDomain(saved);
  }

  async saveAll(events: PasswordChangeEvent[], options?: IRepositoryOptions): Promise<PasswordChangeEvent[]> {
    if (events.length === 0) {
      return [];
    }

    const repository = this.getRepository(options);
    const persistence = events.map(event => repository.create(PasswordChangeEventMapper.toPersistence(event)));
    const saved = await repository.save(persistence);

    return saved.map(event => PasswordChangeEventMapper.toDomain(event));
  }

  private getRepository(options?: IRepositoryOptions): Repository<PasswordChangeEventOrmEntity> {
    return options?.manager ? options.manager.getRepository(PasswordChangeEventOrmEntity) : this.repository;
  }
}
