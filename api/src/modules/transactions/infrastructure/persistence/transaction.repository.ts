import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import {
  ITransactionRepository,
  ListTransactionsInput,
  ListTransactionsOutput,
} from '@/modules/transactions/domain/repositories/transaction.repository.interface';
import { TransactionMapper } from '@/modules/transactions/infrastructure/mappers/transaction.mapper';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, Repository } from 'typeorm';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
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
    const queryBuilder = repository
      .createQueryBuilder('transaction')
      .where('transaction.user_id = :userId', { userId: input.userId })
      .andWhere('transaction.deleted_at IS NULL');

    if (input.status) {
      queryBuilder.andWhere('transaction.status = :status', { status: input.status });
    }

    if (input.type) {
      queryBuilder.andWhere('transaction.type = :type', { type: input.type });
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
      queryBuilder.andWhere('transaction.date >= :dateFrom', { dateFrom: toDateOnlyString(input.dateFrom) });
    }

    if (input.dateTo) {
      queryBuilder.andWhere('transaction.date <= :dateTo', { dateTo: toDateOnlyString(input.dateTo) });
    }

    const [transactions, total] = await queryBuilder
      .orderBy('transaction.date', 'DESC')
      .addOrderBy('transaction.id', 'DESC')
      .skip(offset)
      .take(input.limit)
      .getManyAndCount();

    return {
      items: transactions.map(transaction => TransactionMapper.toDomain(transaction)),
      total,
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
}
