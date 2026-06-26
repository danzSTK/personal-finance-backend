import { dateOnlyFromDatabase } from '@/common/utils/date-only';
import { Transaction } from '@/modules/transactions/domain/entities/transaction.entity';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';

export class TransactionMapper {
  static toDomain(entity: TransactionOrmEntity): Transaction {
    return Transaction.reconstitute(
      {
        userId: entity.user_id,
        accountId: entity.account_id,
        destinationAccountId: entity.destination_account_id,
        categoryId: entity.category_id,
        type: entity.type,
        status: entity.status,
        amountCents: Number(entity.amount_cents),
        date: dateOnlyFromDatabase(entity.date),
        effectiveAt: entity.effective_at,
        description: entity.description,
        direction: entity.direction,
        deletedAt: entity.deleted_at,
        createdAt: entity.created_at,
        updatedAt: entity.updated_at,
      },
      entity.id,
    );
  }

  static toOrm(transaction: Transaction): Partial<TransactionOrmEntity> {
    return {
      id: transaction.id,
      user_id: transaction.userId,
      account_id: transaction.accountId,
      destination_account_id: transaction.destinationAccountId,
      category_id: transaction.categoryId,
      type: transaction.type,
      status: transaction.status,
      amount_cents: transaction.amountCents.toString(),
      date: transaction.date,
      effective_at: transaction.effectiveAt,
      description: transaction.description,
      direction: transaction.direction,
      deleted_at: transaction.deletedAt,
      created_at: transaction.createdAt,
      updated_at: transaction.updatedAt,
    };
  }
}
