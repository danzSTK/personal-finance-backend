import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
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
import { CategoryOrmEntity } from '../modules/categories/infrastructure/persistence/model/category.entity';
import { UserOrmEntity } from '../modules/users/infrastructure/persistence/user-orm-entity';

@Entity('transactions')
@Index('idx_transactions_user_date_id', ['user_id', 'date', 'id'], {
  where: 'is_active = true',
})
@Index('idx_transactions_user', ['user_id'], { where: 'is_active = true' })
@Index('idx_transactions_account', ['account_id'], {
  where: 'is_active = true',
})
@Index('idx_transactions_category', ['category_id'], {
  where: 'is_active = true',
})
@Index('idx_transactions_user_date', ['user_id', 'date'], {
  where: 'is_active = true',
})
@Check('CHK_transactions_amount', `amount > 0`)
@Check(
  'CHK_transactions_deactivation',
  `(is_active = true AND deactivated_at IS NULL) OR (is_active = false AND deactivated_at IS NOT NULL)`,
)
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column('uuid')
  account_id: string;

  @Column('uuid')
  category_id: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date', default: () => 'NOW()' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deactivated_at: Date | null;

  @ManyToOne(() => UserOrmEntity, user => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_transactions_user',
  })
  user: UserOrmEntity;

  @ManyToOne(() => AccountOrmEntity, account => account.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'account_id',
    foreignKeyConstraintName: 'FK_transactions_account',
  })
  account: AccountOrmEntity;

  @ManyToOne(() => CategoryOrmEntity, category => category.transactions, {
    onDelete: 'NO ACTION',
  })
  @JoinColumn({
    name: 'category_id',
    foreignKeyConstraintName: 'FK_transactions_category',
  })
  category: CategoryOrmEntity;
}
