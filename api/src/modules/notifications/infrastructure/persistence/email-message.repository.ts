import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';
import { IEmailMessageRepository } from '@/modules/notifications/domain/repositories/email-message.repository.interface';
import { EmailMessageMapper } from '@/modules/notifications/infrastructure/mappers/email-message.mapper';
import { EmailMessageOrmEntity } from '@/modules/notifications/infrastructure/persistence/email-message-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmailMessageRepository implements IEmailMessageRepository {
  constructor(
    @InjectRepository(EmailMessageOrmEntity)
    private readonly repository: Repository<EmailMessageOrmEntity>,
  ) {}

  async findById(id: string, options?: IRepositoryOptions): Promise<EmailMessage | null> {
    const repository = this.getRepository(options);
    const emailMessage = await repository.findOne({ where: { id } });

    return emailMessage ? EmailMessageMapper.toDomain(emailMessage) : null;
  }

  async findByIdForUpdate(id: string, options: Required<IRepositoryOptions>): Promise<EmailMessage | null> {
    const repository = this.getRepository(options);
    const emailMessage = await repository.findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });

    return emailMessage ? EmailMessageMapper.toDomain(emailMessage) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string, options?: IRepositoryOptions): Promise<EmailMessage | null> {
    const repository = this.getRepository(options);
    const emailMessage = await repository.findOne({ where: { idempotency_key: idempotencyKey } });

    return emailMessage ? EmailMessageMapper.toDomain(emailMessage) : null;
  }

  async save(emailMessage: EmailMessage, options?: IRepositoryOptions): Promise<EmailMessage> {
    const repository = this.getRepository(options);
    await repository.save(EmailMessageMapper.toOrm(emailMessage));

    const saved = await repository.findOne({ where: { id: emailMessage.id } });

    if (!saved) {
      throw new Error('Email message not found after save.');
    }

    return EmailMessageMapper.toDomain(saved);
  }

  private getRepository(options?: IRepositoryOptions): Repository<EmailMessageOrmEntity> {
    return options?.manager ? options.manager.getRepository(EmailMessageOrmEntity) : this.repository;
  }
}
