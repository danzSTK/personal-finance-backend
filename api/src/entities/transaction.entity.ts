import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Account } from './account.entity';
import { Category } from './category.entity';

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

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Account, (account) => account.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @ManyToOne(() => Category, (category) => category.transactions, {
    onDelete: 'NO ACTION',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
