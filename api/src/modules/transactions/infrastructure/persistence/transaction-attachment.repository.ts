import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { AssetStatus } from '@/modules/assets/domain/enums';
import { AssetMapper } from '@/modules/assets/infrastructure/mappers/asset.mapper';
import { TransactionAttachment } from '@/modules/transactions/domain/entities/transaction-attachment.entity';
import {
  ITransactionAttachmentRepository,
  TransactionAttachmentWithAsset,
} from '@/modules/transactions/domain/repositories/transaction-attachment.repository.interface';
import { TransactionAttachmentOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-attachment-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TransactionAttachmentRepository implements ITransactionAttachmentRepository {
  constructor(
    @InjectRepository(TransactionAttachmentOrmEntity)
    private readonly repository: Repository<TransactionAttachmentOrmEntity>,
  ) {}

  private getRepository(options?: IRepositoryOptions): Repository<TransactionAttachmentOrmEntity> {
    return options?.manager ? options.manager.getRepository(TransactionAttachmentOrmEntity) : this.repository;
  }

  async findByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<TransactionAttachment[]> {
    const repo = this.getRepository(options);
    const entities = await repo.find({
      where: { transactionId },
      order: { position: 'ASC' },
    });

    return entities.map(entity => this.toDomain(entity));
  }

  async findByIdAndTransactionId(
    id: string,
    transactionId: string,
    options?: IRepositoryOptions,
  ): Promise<TransactionAttachment | null> {
    const repo = this.getRepository(options);
    const entity = await repo.findOne({
      where: { id, transactionId },
    });

    return entity ? this.toDomain(entity) : null;
  }

  async findReadyByTransactionId(
    transactionId: string,
    options?: IRepositoryOptions,
  ): Promise<TransactionAttachmentWithAsset[]> {
    const repo = this.getRepository(options);
    const entities = await repo
      .createQueryBuilder('ta')
      .innerJoinAndSelect('ta.asset', 'asset')
      .where('ta.transaction_id = :transactionId', { transactionId })
      .andWhere('asset.status = :status', { status: AssetStatus.READY })
      .orderBy('ta.position', 'ASC')
      .getMany();

    return entities.map(entity => ({
      attachment: this.toDomain(entity),
      asset: AssetMapper.toDomain(entity.asset!),
    }));
  }

  async countActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<number> {
    const repo = this.getRepository(options);
    return repo
      .createQueryBuilder('ta')
      .innerJoin('ta.asset', 'asset')
      .where('ta.transaction_id = :transactionId', { transactionId })
      .andWhere('asset.status IN (:...statuses)', {
        statuses: [AssetStatus.PENDING_UPLOAD, AssetStatus.READY],
      })
      .getCount();
  }

  async countActiveByTransactionIds(
    transactionIds: string[],
    options?: IRepositoryOptions,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (transactionIds.length === 0) {
      return map;
    }

    const repo = this.getRepository(options);
    const raw = await repo
      .createQueryBuilder('ta')
      .innerJoin('ta.asset', 'asset')
      .select('ta.transaction_id', 'transactionId')
      .addSelect('COUNT(ta.id)', 'count')
      .where('ta.transaction_id IN (:...transactionIds)', { transactionIds })
      .andWhere('asset.status IN (:...statuses)', {
        statuses: [AssetStatus.PENDING_UPLOAD, AssetStatus.READY],
      })
      .groupBy('ta.transaction_id')
      .getRawMany<{ transactionId: string; count: string }>();

    for (const row of raw) {
      map.set(row.transactionId, Number(row.count));
    }

    return map;
  }

  async save(attachment: TransactionAttachment, options?: IRepositoryOptions): Promise<TransactionAttachment> {
    const repo = this.getRepository(options);
    const orm = this.toOrm(attachment);
    const saved = await repo.save(orm);
    return this.toDomain(saved);
  }

  async saveAll(attachments: TransactionAttachment[], options?: IRepositoryOptions): Promise<TransactionAttachment[]> {
    if (attachments.length === 0) {
      return [];
    }

    const repo = this.getRepository(options);
    const orms = attachments.map(attachment => this.toOrm(attachment));
    const saved = await repo.save(orms);
    return saved.map(item => this.toDomain(item));
  }

  async delete(id: string, options?: IRepositoryOptions): Promise<void> {
    const repo = this.getRepository(options);
    await repo.delete({ id });
  }

  async reorderPositions(
    transactionId: string,
    positions: Array<{ id: string; position: number }>,
    options?: IRepositoryOptions,
  ): Promise<void> {
    if (positions.length === 0) {
      return;
    }

    const repo = this.getRepository(options);
    const parameters: (string | number)[] = [transactionId];
    const cases: string[] = [];
    const idParams: string[] = [];

    positions.forEach(item => {
      parameters.push(item.id);
      const idParamIndex = parameters.length;
      parameters.push(item.position);
      const posParamIndex = parameters.length;

      cases.push(`WHEN id = $${idParamIndex} THEN $${posParamIndex}::smallint`);
      idParams.push(`$${idParamIndex}`);
    });

    const sql = `
      UPDATE transaction_attachments
      SET position = CASE ${cases.join(' ')} END,
          updated_at = now()
      WHERE transaction_id = $1 AND id IN (${idParams.join(', ')})
    `;

    await repo.query(sql, parameters);
  }

  private toDomain(orm: TransactionAttachmentOrmEntity): TransactionAttachment {
    return TransactionAttachment.reconstitute({
      id: orm.id,
      transactionId: orm.transactionId,
      assetId: orm.assetId,
      position: orm.position,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  private toOrm(domain: TransactionAttachment): TransactionAttachmentOrmEntity {
    const orm = new TransactionAttachmentOrmEntity();
    orm.id = domain.id;
    orm.transactionId = domain.transactionId;
    orm.assetId = domain.assetId;
    orm.position = domain.position;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
