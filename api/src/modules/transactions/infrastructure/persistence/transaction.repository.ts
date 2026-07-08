import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { TRANSACTION_LIST_SORT_DATE_ASC, TransactionListSort } from '@/common/models/constants';
import { TransactionStatus, TransactionType } from '@/common/models/enums';
import {
  ITransactionRepository,
  ListTransactionsInput,
  ListTransactionsOutput,
  TransactionGroupedSummary,
  TransactionListSummary,
  TransactionTypeSummary,
} from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionMapper } from '@/modules/transactions/infrastructure/mappers/transaction.mapper';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository, SelectQueryBuilder } from 'typeorm';

interface TransactionSummaryRaw {
  pendingCents: string | null;
  effectiveCents: string | null;
}

interface TransactionGroupedSummaryRaw {
  incomePendingCents: string | null;
  incomeEffectiveCents: string | null;
  expensePendingCents: string | null;
  expenseEffectiveCents: string | null;
}

@Injectable()
export class TransactionRepository implements ITransactionRepository {
  constructor(
    @InjectRepository(TransactionOrmEntity)
    private readonly transactionRepository: Repository<TransactionOrmEntity>,
  ) {}

  async findByIdAndUserId(
    transactionId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<Transaction | null> {
    const repository = options?.manager
      ? options.manager.getRepository(TransactionOrmEntity)
      : this.transactionRepository;

    const transaction = await repository.findOne({
      where: {
        id: transactionId,
        user_id: userId,
        deleted_at: IsNull(),
      },
    });

    if (!transaction) {
      return null;
    }

    return TransactionMapper.toDomain(transaction);
  }

  async list(input: ListTransactionsInput, options?: IRepositoryOptions): Promise<ListTransactionsOutput> {
    const repository = options?.manager
      ? options.manager.getRepository(TransactionOrmEntity)
      : this.transactionRepository;
    const offset = (input.page - 1) * input.limit;
    const queryBuilder = this.applyListFilters(repository.createQueryBuilder('transaction'), input);
    const direction = this.getSortDirection(input.sort);

    const [transactions, total] = await queryBuilder
      .orderBy('transaction.date', direction)
      .addOrderBy('transaction.id', direction)
      .skip(offset)
      .take(input.limit)
      .getManyAndCount();
    const summary = await this.getListSummary(repository, input);

    return {
      items: transactions.map(transaction => TransactionMapper.toDomain(transaction)),
      total,
      summary,
    };
  }

  async save(transaction: Transaction, options?: IRepositoryOptions): Promise<Transaction> {
    const repository = options?.manager
      ? options.manager.getRepository(TransactionOrmEntity)
      : this.transactionRepository;
    const payload = TransactionMapper.toOrm(transaction);

    await repository.save(payload);

    const saved = await repository.findOne({
      where: {
        id: transaction.id,
      },
    });

    if (!saved) {
      throw new Error('Transaction not found after save');
    }

    return TransactionMapper.toDomain(saved);
  }

  private applyListFilters(
    queryBuilder: SelectQueryBuilder<TransactionOrmEntity>,
    input: Pick<
      ListTransactionsInput,
      'userId' | 'status' | 'type' | 'accountId' | 'categoryId' | 'dateFrom' | 'dateTo'
    >,
  ): SelectQueryBuilder<TransactionOrmEntity> {
    queryBuilder
      .where('transaction.user_id = :userId', { userId: input.userId })
      .andWhere('transaction.deleted_at IS NULL');

    if (input.status) {
      queryBuilder.andWhere('transaction.status = :status', { status: input.status });
    }

    if (input.type) {
      queryBuilder.andWhere('transaction.type = :type', { type: input.type });
    } else {
      queryBuilder.andWhere('transaction.type IN (:...defaultTypes)', {
        defaultTypes: [TransactionType.INCOME, TransactionType.EXPENSE],
      });
    }

    if (input.accountId) {
      queryBuilder.andWhere(
        new Brackets(nested => {
          nested
            .where('transaction.account_id = :accountId', { accountId: input.accountId })
            .orWhere('transaction.destination_account_id = :accountId', { accountId: input.accountId });
        }),
      );
    }

    if (input.categoryId) {
      queryBuilder.andWhere('transaction.category_id = :categoryId', { categoryId: input.categoryId });
    }

    if (input.dateFrom) {
      queryBuilder.andWhere('transaction.date >= :dateFrom', { dateFrom: input.dateFrom });
    }

    if (input.dateTo) {
      queryBuilder.andWhere('transaction.date <= :dateTo', { dateTo: input.dateTo });
    }

    return queryBuilder;
  }

  private async getListSummary(
    repository: Repository<TransactionOrmEntity>,
    input: ListTransactionsInput,
  ): Promise<TransactionListSummary> {
    if (!input.type) {
      return this.getGroupedSummary(repository, input);
    }

    return this.getTypeSummary(repository, input);
  }

  private async getTypeSummary(
    repository: Repository<TransactionOrmEntity>,
    input: ListTransactionsInput,
  ): Promise<TransactionTypeSummary> {
    const raw = await this.applyListFilters(repository.createQueryBuilder('transaction'), input)
      .select(
        `COALESCE(SUM(CASE WHEN transaction.status = :pendingStatus THEN transaction.amount_cents ELSE 0 END), 0)::bigint`,
        'pendingCents',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN transaction.status = :effectiveStatus THEN transaction.amount_cents ELSE 0 END), 0)::bigint`,
        'effectiveCents',
      )
      .setParameters({
        pendingStatus: TransactionStatus.PENDING,
        effectiveStatus: TransactionStatus.EFFECTIVE,
      })
      .getRawOne<TransactionSummaryRaw>();
    const pendingCents = this.toSafeCents(raw?.pendingCents ?? '0');
    const effectiveCents = this.toSafeCents(raw?.effectiveCents ?? '0');

    return {
      pendingCents,
      effectiveCents,
      totalCents: this.toSafeCents(String(BigInt(pendingCents) + BigInt(effectiveCents))),
    };
  }

  private async getGroupedSummary(
    repository: Repository<TransactionOrmEntity>,
    input: ListTransactionsInput,
  ): Promise<TransactionGroupedSummary> {
    const raw = await this.applyListFilters(repository.createQueryBuilder('transaction'), input)
      .select(
        `COALESCE(SUM(CASE WHEN transaction.type = :incomeType AND transaction.status = :pendingStatus THEN transaction.amount_cents ELSE 0 END), 0)::bigint`,
        'incomePendingCents',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN transaction.type = :incomeType AND transaction.status = :effectiveStatus THEN transaction.amount_cents ELSE 0 END), 0)::bigint`,
        'incomeEffectiveCents',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN transaction.type = :expenseType AND transaction.status = :pendingStatus THEN transaction.amount_cents ELSE 0 END), 0)::bigint`,
        'expensePendingCents',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN transaction.type = :expenseType AND transaction.status = :effectiveStatus THEN transaction.amount_cents ELSE 0 END), 0)::bigint`,
        'expenseEffectiveCents',
      )
      .setParameters({
        incomeType: TransactionType.INCOME,
        expenseType: TransactionType.EXPENSE,
        pendingStatus: TransactionStatus.PENDING,
        effectiveStatus: TransactionStatus.EFFECTIVE,
      })
      .getRawOne<TransactionGroupedSummaryRaw>();
    const income = this.toTypeSummary(raw?.incomePendingCents ?? '0', raw?.incomeEffectiveCents ?? '0');
    const expense = this.toTypeSummary(raw?.expensePendingCents ?? '0', raw?.expenseEffectiveCents ?? '0');
    const pendingDeltaCents = this.toSafeCents(String(BigInt(income.pendingCents) - BigInt(expense.pendingCents)));
    const effectiveDeltaCents = this.toSafeCents(
      String(BigInt(income.effectiveCents) - BigInt(expense.effectiveCents)),
    );

    return {
      income,
      expense,
      balance: {
        pendingDeltaCents,
        effectiveDeltaCents,
        expectedBalanceCents: this.toSafeCents(String(BigInt(effectiveDeltaCents) + BigInt(pendingDeltaCents))),
      },
    };
  }

  private toTypeSummary(pendingValue: string, effectiveValue: string): TransactionTypeSummary {
    const pendingCents = this.toSafeCents(pendingValue);
    const effectiveCents = this.toSafeCents(effectiveValue);

    return {
      pendingCents,
      effectiveCents,
      totalCents: this.toSafeCents(String(BigInt(pendingCents) + BigInt(effectiveCents))),
    };
  }

  private getSortDirection(sort: TransactionListSort): 'ASC' | 'DESC' {
    return sort === TRANSACTION_LIST_SORT_DATE_ASC ? 'ASC' : 'DESC';
  }

  private toSafeCents(value: string): number {
    const cents = Number(value);

    if (!Number.isSafeInteger(cents)) {
      throw new Error('Transaction summary exceeded safe integer range.');
    }

    return cents;
  }
}
