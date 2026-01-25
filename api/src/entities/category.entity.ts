import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { CategoryType } from '../common/models/enums/category-types.enum';
import { Transaction } from './transaction.entity';
import { User } from '../modules/users/entities/user.entity';

@Entity('categories')
@Index('idx_categories_user_name_type_active', ['user_id', 'name', 'type'], {
  where: 'is_active = true',
})
@Index('idx_categories_user_type', ['user_id', 'type'], {
  where: 'is_active = true',
})
@Index('idx_categories_user_active', ['user_id'], { where: 'is_active = true' })
@Check('CHK_categories_type', `"type" IN ('INCOME', 'EXPENSE')`)
@Check(
  'CHK_categories_deactivation',
  `(is_active = true AND deactivated_at IS NULL) OR (is_active = false AND deactivated_at IS NOT NULL)`,
)
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: CategoryType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  deactivated_at: Date | null;

  @ManyToOne(() => User, (user) => user.categories, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_categories_user',
  })
  user: User;

  @OneToMany(() => Transaction, (transaction) => transaction.category)
  transactions: Transaction[];
}
