import { TransactionDirection, TransactionStatus, TransactionType } from '@/common/models/enums';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/model/category.entity';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transactions')
@Index('idx_transactions_user_date_id', ['user_id', 'date', 'id'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_transactions_user_status_date', ['user_id', 'status', 'date', 'id'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_transactions_account_effective', ['user_id', 'account_id', 'date'], {
  where: "deleted_at IS NULL AND status = 'EFFECTIVE'",
})
@Index('idx_transactions_destination_account_effective', ['user_id', 'destination_account_id', 'date'], {
  where: "deleted_at IS NULL AND status = 'EFFECTIVE' AND destination_account_id IS NOT NULL",
})
@Index('idx_transactions_category_date', ['user_id', 'category_id', 'date'], {
  where: 'deleted_at IS NULL',
})
@Check('CHK_transactions_type', `"type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT')`)
@Check('CHK_transactions_status', `"status" IN ('PENDING', 'EFFECTIVE')`)
@Check('CHK_transactions_amount_cents', `"amount_cents" > 0`)
@Check(
  'CHK_transactions_effective_at_status',
  `(("status" = 'PENDING' AND "effective_at" IS NULL) OR ("status" = 'EFFECTIVE' AND "effective_at" IS NOT NULL))`,
)
@Check(
  'CHK_transactions_transfer_destination',
  `(("type" = 'TRANSFER' AND "destination_account_id" IS NOT NULL AND "destination_account_id" <> "account_id") OR ("type" <> 'TRANSFER' AND "destination_account_id" IS NULL))`,
)
@Check(
  'CHK_transactions_direction',
  `(("type" = 'ADJUSTMENT' AND "direction" IN ('INCREASE', 'DECREASE')) OR ("type" <> 'ADJUSTMENT' AND "direction" IS NULL))`,
)
@Check('CHK_transactions_adjustment_description', `"type" <> 'ADJUSTMENT' OR length(btrim("description")) > 0`)
@Check('CHK_transactions_transfer_not_deleted', `"type" <> 'TRANSFER' OR "deleted_at" IS NULL`)
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('uuid')
  account_id: string;

  @Column('uuid', { nullable: true })
  destination_account_id: string | null;

  @Column('uuid')
  category_id: string;

  @Column({ type: 'varchar', length: 20 })
  type: TransactionType;

  @Column({ type: 'varchar', length: 20 })
  status: TransactionStatus;

  @Column({ type: 'bigint' })
  amount_cents: string;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  date: Date | string;

  @Column({ type: 'timestamptz', nullable: true })
  effective_at: Date | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  direction: TransactionDirection | null;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => UserOrmEntity, user => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_transactions_user',
  })
  user: UserOrmEntity;

  @ManyToOne(() => AccountOrmEntity, account => account.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'account_id',
    foreignKeyConstraintName: 'FK_transactions_account',
  })
  account: AccountOrmEntity;

  @ManyToOne(() => AccountOrmEntity, {
    onDelete: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({
    name: 'destination_account_id',
    foreignKeyConstraintName: 'FK_transactions_destination_account',
  })
  destinationAccount: AccountOrmEntity | null;

  @ManyToOne(() => CategoryOrmEntity, category => category.transactions, {
    onDelete: 'NO ACTION',
  })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'FK_transactions_category',
  })
  category: CategoryOrmEntity;
}
