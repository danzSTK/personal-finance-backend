import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import {
  FiscalNoteListSort,
  FiscalNoteListSorts,
  SEFAZ_CE_TIMEZONE_OFFSET,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNote } from '@/modules/fiscal-notes/domain/entities/fiscal-note.entity';
import {
  FiscalNoteListItem,
  FiscalNoteListSummary,
  IFiscalNoteRepository,
  ListFiscalNotesRepositoryInput,
  ListFiscalNotesRepositoryOutput,
} from '@/modules/fiscal-notes/domain/repositories';
import { FiscalNoteMapper } from '@/modules/fiscal-notes/infrastructure/mappers/fiscal-note.mapper';
import { FiscalNoteItemOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-item-orm.entity';
import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { FiscalNotePaymentOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-payment-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository, SelectQueryBuilder } from 'typeorm';

interface FiscalNoteListSummaryRaw {
  totalNotes: number | string | null;
  totalGrossAmountCents: string | null;
  totalDiscountAmountCents: string | null;
  totalPayableAmountCents: string | null;
  totalTaxAmountCents: string | null;
}

interface FiscalNoteListRowRaw {
  id: string;
  transactionId: string;
  accessKey: string;
  sourceUf: string;
  number: string;
  series: string;
  issuedAt: Date | string;
  issuerName: string;
  issuerCnpj: string;
  grossAmountCents: string;
  discountAmountCents: string;
  payableAmountCents: string;
  taxAmountCents: string;
  itemsCount: number | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

const SORT_SPEC_BY_OPTION: Readonly<Record<FiscalNoteListSort, { column: string; direction: 'ASC' | 'DESC' }>> = {
  [FiscalNoteListSorts.ISSUED_AT_DESC]: { column: 'fn.issuedAt', direction: 'DESC' },
  [FiscalNoteListSorts.ISSUED_AT_ASC]: { column: 'fn.issuedAt', direction: 'ASC' },
  [FiscalNoteListSorts.PAYABLE_AMOUNT_DESC]: { column: 'fn.payableAmountCents', direction: 'DESC' },
  [FiscalNoteListSorts.PAYABLE_AMOUNT_ASC]: { column: 'fn.payableAmountCents', direction: 'ASC' },
  [FiscalNoteListSorts.CREATED_AT_DESC]: { column: 'fn.createdAt', direction: 'DESC' },
  [FiscalNoteListSorts.CREATED_AT_ASC]: { column: 'fn.createdAt', direction: 'ASC' },
};

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

  async findActiveByIdAndUserId(id: string, userId: string, options?: IRepositoryOptions): Promise<FiscalNote | null> {
    const repo = this.getNoteRepository(options);
    const entity = await repo
      .createQueryBuilder('fn')
      .leftJoinAndSelect('fn.items', 'item')
      .leftJoinAndSelect('fn.payments', 'payment')
      .where('fn.id = :id', { id })
      .andWhere('fn.userId = :userId', { userId })
      .andWhere('fn.deletedAt IS NULL')
      .orderBy('item.position', 'ASC')
      .addOrderBy('payment.position', 'ASC')
      .getOne();

    return entity ? FiscalNoteMapper.toDomain(entity) : null;
  }

  async list(
    input: ListFiscalNotesRepositoryInput,
    options?: IRepositoryOptions,
  ): Promise<ListFiscalNotesRepositoryOutput> {
    const repo = this.getNoteRepository(options);

    const summaryRaw = await this.applyListFilters(repo.createQueryBuilder('fn'), input)
      .select('COUNT(*)::int', 'totalNotes')
      .addSelect('COALESCE(SUM(fn.gross_amount_cents), 0)', 'totalGrossAmountCents')
      .addSelect('COALESCE(SUM(fn.discount_amount_cents), 0)', 'totalDiscountAmountCents')
      .addSelect('COALESCE(SUM(fn.payable_amount_cents), 0)', 'totalPayableAmountCents')
      .addSelect('COALESCE(SUM(fn.tax_amount_cents), 0)', 'totalTaxAmountCents')
      .getRawOne<FiscalNoteListSummaryRaw>();

    const total = FiscalNoteMapper.toSafeNonNegativeCents(summaryRaw?.totalNotes ?? 0, 'totalNotes');
    const summary: FiscalNoteListSummary = {
      totalNotes: total,
      totalGrossAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(
        summaryRaw?.totalGrossAmountCents ?? '0',
        'totalGrossAmountCents',
      ),
      totalDiscountAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(
        summaryRaw?.totalDiscountAmountCents ?? '0',
        'totalDiscountAmountCents',
      ),
      totalPayableAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(
        summaryRaw?.totalPayableAmountCents ?? '0',
        'totalPayableAmountCents',
      ),
      totalTaxAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(
        summaryRaw?.totalTaxAmountCents ?? '0',
        'totalTaxAmountCents',
      ),
    };

    const offset = (input.page - 1) * input.limit;
    if (total === 0 || offset >= total) {
      return {
        items: [],
        total,
        summary,
      };
    }

    const sortSpec = SORT_SPEC_BY_OPTION[input.sort];
    const rawRows = await this.applyListFilters(repo.createQueryBuilder('fn'), input)
      .select('fn.id', 'id')
      .addSelect('fn.transactionId', 'transactionId')
      .addSelect('fn.accessKey', 'accessKey')
      .addSelect('fn.sourceUf', 'sourceUf')
      .addSelect('fn.number', 'number')
      .addSelect('fn.series', 'series')
      .addSelect('fn.issuedAt', 'issuedAt')
      .addSelect('fn.issuerName', 'issuerName')
      .addSelect('fn.issuerCnpj', 'issuerCnpj')
      .addSelect('fn.grossAmountCents', 'grossAmountCents')
      .addSelect('fn.discountAmountCents', 'discountAmountCents')
      .addSelect('fn.payableAmountCents', 'payableAmountCents')
      .addSelect('fn.taxAmountCents', 'taxAmountCents')
      .addSelect('(SELECT COUNT(*)::int FROM fiscal_note_items fni WHERE fni.fiscal_note_id = fn.id)', 'itemsCount')
      .addSelect('fn.createdAt', 'createdAt')
      .addSelect('fn.updatedAt', 'updatedAt')
      .orderBy(sortSpec.column, sortSpec.direction)
      .addOrderBy('fn.id', sortSpec.direction)
      .offset(offset)
      .limit(input.limit)
      .getRawMany<FiscalNoteListRowRaw>();

    const items: FiscalNoteListItem[] = rawRows.map(row => ({
      id: row.id,
      transactionId: row.transactionId,
      accessKey: row.accessKey.trim(),
      sourceUf: row.sourceUf.trim(),
      number: row.number,
      series: row.series,
      issuedAt: row.issuedAt instanceof Date ? row.issuedAt : new Date(row.issuedAt),
      issuerName: row.issuerName,
      issuerCnpj: row.issuerCnpj.trim(),
      grossAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(row.grossAmountCents, 'grossAmountCents'),
      discountAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(row.discountAmountCents, 'discountAmountCents'),
      payableAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(row.payableAmountCents, 'payableAmountCents'),
      taxAmountCents: FiscalNoteMapper.toSafeNonNegativeCents(row.taxAmountCents, 'taxAmountCents'),
      itemsCount: FiscalNoteMapper.toSafeNonNegativeCents(row.itemsCount, 'itemsCount'),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
    }));

    return {
      items,
      total,
      summary,
    };
  }

  private applyListFilters(
    qb: SelectQueryBuilder<FiscalNoteOrmEntity>,
    input: ListFiscalNotesRepositoryInput,
  ): SelectQueryBuilder<FiscalNoteOrmEntity> {
    qb.where('fn.userId = :userId', { userId: input.userId }).andWhere('fn.deletedAt IS NULL');

    if (input.issuedFrom) {
      const issuedFromStart = new Date(`${input.issuedFrom}T00:00:00.000${SEFAZ_CE_TIMEZONE_OFFSET}`);
      qb.andWhere('fn.issuedAt >= :issuedFromStart', { issuedFromStart });
    }

    if (input.issuedTo) {
      const [year, month, day] = input.issuedTo.split('-').map(Number);
      const nextUtcDate = new Date(Date.UTC(year, month - 1, day + 1));
      const nextYear = String(nextUtcDate.getUTCFullYear()).padStart(4, '0');
      const nextMonth = String(nextUtcDate.getUTCMonth() + 1).padStart(2, '0');
      const nextDay = String(nextUtcDate.getUTCDate()).padStart(2, '0');
      const issuedToExclusiveEnd = new Date(
        `${nextYear}-${nextMonth}-${nextDay}T00:00:00.000${SEFAZ_CE_TIMEZONE_OFFSET}`,
      );
      qb.andWhere('fn.issuedAt < :issuedToExclusiveEnd', { issuedToExclusiveEnd });
    }

    if (input.issuerCnpj) {
      qb.andWhere('fn.issuerCnpj = :issuerCnpj', { issuerCnpj: input.issuerCnpj });
    }

    if (input.sourceUf) {
      qb.andWhere('fn.sourceUf = :sourceUf', { sourceUf: input.sourceUf });
    }

    if (input.minAmountCents !== undefined) {
      qb.andWhere('fn.payableAmountCents >= :minAmountCents', { minAmountCents: String(input.minAmountCents) });
    }

    if (input.maxAmountCents !== undefined) {
      qb.andWhere('fn.payableAmountCents <= :maxAmountCents', { maxAmountCents: String(input.maxAmountCents) });
    }

    const trimmedSearch = input.search?.trim();
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/[\\%_]/g, '\\$&');
      const searchPattern = `%${escaped}%`;
      qb.andWhere(
        new Brackets(nested => {
          nested.where(`fn.issuerName ILIKE :searchPattern ESCAPE '\\'`, { searchPattern }).orWhere(
            `EXISTS (
              SELECT 1
              FROM fiscal_note_items fni
              WHERE fni.fiscal_note_id = fn.id
                AND fni.raw_description ILIKE :searchPattern ESCAPE '\\'
            )`,
            { searchPattern },
          );
        }),
      );
    }

    return qb;
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
