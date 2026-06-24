import { AccountType, ColorToken, IconKey } from '@/common/models/enums';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
@Entity('accounts')
@Index('idx_accounts_user_id', ['user_id'])
@Index('idx_accounts_user_not_archived', ['user_id'], { where: 'is_archived = false' })
@Index('UQ_accounts_user_default_active', ['user_id'], {
  unique: true,
  where: 'is_default = true AND is_archived = false',
})
@Index('UQ_accounts_user_cash', ['user_id'], {
  unique: true,
  where: "account_type = 'CASH'",
})
@Check('CHK_accounts_type', `"account_type" IN ('CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT')`)
@Check('CHK_accounts_default_not_archived', `NOT (is_default = true AND is_archived = true)`)
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'enum', enum: AccountType })
  account_type: AccountType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: '0.00',
    transformer: {
      to: (value: number) => value.toString(),
      from: (value: string) => parseFloat(value),
    },
  })
  initial_balance: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color: ColorToken | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: IconKey | null;

  @Column({ type: 'boolean', default: true })
  include_in_total: boolean;

  @Column({ type: 'boolean', default: false })
  is_archived: boolean;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => UserOrmEntity, user => user.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_accounts_user' })
  user: UserOrmEntity;

  @OneToMany(() => TransactionOrmEntity, transaction => transaction.account)
  transactions: TransactionOrmEntity[];
}
