import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { FiscalNoteMapper } from '@/modules/fiscal-notes/infrastructure/mappers/fiscal-note.mapper';
import { FiscalNoteItemOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-item-orm.entity';
import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { FiscalNotePaymentOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-payment-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

@Injectable()
export class FiscalNoteRepository implements IFiscalNoteRepository {
  constructor(
    @InjectRepository(FiscalNoteOrmEntity)
    private readonly noteRepository: Repository<FiscalNoteOrmEntity>,
    @InjectRepository(FiscalNoteItemOrmEntity)
    private readonly itemRepository: Repository<FiscalNoteItemOrmEntity>,
    @InjectRepository(FiscalNotePaymentOrmEntity)
    private readonly paymentRepository: Repository<FiscalNotePaymentOrmEntity>,
  ) {}

  private getNoteRepository(options?: IRepositoryOptions): Repository<FiscalNoteOrmEntity> {
    return options?.manager ? options.manager.getRepository(FiscalNoteOrmEntity) : this.noteRepository;
  }

  private getItemRepository(options?: IRepositoryOptions): Repository<FiscalNoteItemOrmEntity> {
    return options?.manager ? options.manager.getRepository(FiscalNoteItemOrmEntity) : this.itemRepository;
  }

  private getPaymentRepository(options?: IRepositoryOptions): Repository<FiscalNotePaymentOrmEntity> {
    return options?.manager ? options.manager.getRepository(FiscalNotePaymentOrmEntity) : this.paymentRepository;
  }

  async findActiveByUserIdAndAccessKey(
    userId: string,
    accessKey: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null> {
    const repo = this.getNoteRepository(options);
    const entity = await repo
      .createQueryBuilder('fn')
      .leftJoinAndSelect('fn.items', 'item')
      .leftJoinAndSelect('fn.payments', 'payment')
      .where('fn.userId = :userId', { userId })
      .andWhere('fn.accessKey = :accessKey', { accessKey })
      .andWhere('fn.deletedAt IS NULL')
      .orderBy('item.position', 'ASC')
      .addOrderBy('payment.position', 'ASC')
      .getOne();

    return entity ? FiscalNoteMapper.toDomain(entity) : null;
  }

  async findActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<FiscalNote | null> {
    const repo = this.getNoteRepository(options);
    const entity = await repo
      .createQueryBuilder('fn')
      .leftJoinAndSelect('fn.items', 'item')
      .leftJoinAndSelect('fn.payments', 'payment')
      .where('fn.transactionId = :transactionId', { transactionId })
      .andWhere('fn.deletedAt IS NULL')
      .orderBy('item.position', 'ASC')
      .addOrderBy('payment.position', 'ASC')
      .getOne();

    return entity ? FiscalNoteMapper.toDomain(entity) : null;
  }

  async findActiveByTransactionIdAndUserId(
    transactionId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<FiscalNote | null> {
    const repo = this.getNoteRepository(options);
    const entity = await repo
      .createQueryBuilder('fn')
      .leftJoinAndSelect('fn.items', 'item')
      .leftJoinAndSelect('fn.payments', 'payment')
      .where('fn.transactionId = :transactionId', { transactionId })
      .andWhere('fn.userId = :userId', { userId })
      .andWhere('fn.deletedAt IS NULL')
      .orderBy('item.position', 'ASC')
      .addOrderBy('payment.position', 'ASC')
      .getOne();

    return entity ? FiscalNoteMapper.toDomain(entity) : null;
  }

  async hasActiveByTransactionId(transactionId: string, options?: IRepositoryOptions): Promise<boolean> {
    const repo = this.getNoteRepository(options);
    const count = await repo.count({
      where: {
        transactionId,
        deletedAt: IsNull(),
      },
    });

    return count > 0;
  }

  async findActiveTransactionIds(transactionIds: string[], options?: IRepositoryOptions): Promise<Set<string>> {
    if (transactionIds.length === 0) {
      return new Set<string>();
    }

    const repo = this.getNoteRepository(options);
    const rows = await repo
      .createQueryBuilder('fn')
      .select('fn.transactionId', 'transactionId')
      .distinct(true)
      .where('fn.transactionId IN (:...transactionIds)', { transactionIds })
      .andWhere('fn.deletedAt IS NULL')
      .getRawMany<{ transactionId: string }>();

    return new Set(rows.map(row => row.transactionId));
  }

  async save(fiscalNote: FiscalNote, options?: IRepositoryOptions): Promise<FiscalNote> {
    const noteRepo = this.getNoteRepository(options);
    const existing = await noteRepo.findOne({
      where: { id: fiscalNote.id },
      select: ['id'],
    });

    if (existing) {
      await noteRepo.update(
        { id: fiscalNote.id },
        {
          deletedAt: fiscalNote.deletedAt,
          updatedAt: fiscalNote.updatedAt,
        },
      );
    } else {
      const noteOrm = FiscalNoteMapper.toOrm(fiscalNote);
      await noteRepo.insert(noteOrm);

      const itemOrms = fiscalNote.items.map(item => FiscalNoteMapper.toItemOrm(item));
      if (itemOrms.length > 0) {
        const itemRepo = this.getItemRepository(options);
        await itemRepo.insert(itemOrms);
      }

      const paymentOrms = fiscalNote.payments.map(payment => FiscalNoteMapper.toPaymentOrm(payment));
      if (paymentOrms.length > 0) {
        const paymentRepo = this.getPaymentRepository(options);
        await paymentRepo.insert(paymentOrms);
      }
    }

    const saved = await noteRepo
      .createQueryBuilder('fn')
      .leftJoinAndSelect('fn.items', 'item')
      .leftJoinAndSelect('fn.payments', 'payment')
      .where('fn.id = :id', { id: fiscalNote.id })
      .orderBy('item.position', 'ASC')
      .addOrderBy('payment.position', 'ASC')
      .getOne();

    if (!saved) {
      throw new Error('Fiscal note not found after save');
    }

    return FiscalNoteMapper.toDomain(saved);
  }

  async softDeleteByTransactionId(
    transactionId: string,
    userId: string,
    options: Required<IRepositoryOptions>,
  ): Promise<boolean> {
    const repo = this.getNoteRepository(options);
    const result = await repo
      .createQueryBuilder()
      .update(FiscalNoteOrmEntity)
      .set({
        deletedAt: () => 'now()',
        updatedAt: () => 'now()',
      })
      .where('transaction_id = :transactionId', { transactionId })
      .andWhere('user_id = :userId', { userId })
      .andWhere('deleted_at IS NULL')
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
