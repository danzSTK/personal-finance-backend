import { AccountType } from '../common/models/enums/account-type.enum';
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
import { Transaction } from './transaction.entity';
import { User } from '../modules/users/entities/user.entity';

@Entity('accounts')
@Index('idx_accounts_user_id', ['user_id'])
@Index('idx_accounts_user_active', ['user_id'], { where: 'is_active = true' })
@Check('CHK_accounts_type', `"account_type" IN ('SAVINGS', 'CHECKING', 'CREDIT_CARD', 'CASH')`)
@Check(
  'CHK_accounts_deactivation',
  `(is_active = true AND deactivated_at IS NULL) OR (is_active = false AND deactivated_at IS NOT NULL)`,
)
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 40 })
  account_type: AccountType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: '0.00' })
  initial_balance: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deactivated_at: Date | null;

  @ManyToOne(() => User, user => user.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_accounts_user' })
  user: User;

  @OneToMany(() => Transaction, transaction => transaction.account)
  transactions: Transaction[];
}
