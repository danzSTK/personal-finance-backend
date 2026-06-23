import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';
import { Transaction } from '@/entities/transaction.entity';
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
@Entity('categories')
@Index('UQ_categories_user_type_name_not_archived', ['user_id', 'type', 'name'], {
  unique: true,
  where: 'is_archived = false',
})
@Index('idx_categories_user_type_not_archived', ['user_id', 'type'], {
  where: 'is_archived = false',
})
@Index('idx_categories_user_not_archived', ['user_id'], { where: 'is_archived = false' })
@Check('CHK_categories_type', `"type" IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'INVESTMENT')`)
@Check('CHK_categories_name_normalized', `"name" ~ '^[a-z]+(-[a-z]+)*$'`)
@Check('CHK_categories_display_name_not_empty', `length(btrim("display_name")) > 0`)
@Check('CHK_categories_color_token_not_empty', `"color_token" IS NULL OR length(btrim("color_token")) > 0`)
@Check('CHK_categories_icon_key_not_empty', `"icon_key" IS NULL OR length(btrim("icon_key")) > 0`)
@Check('CHK_categories_sort_order', `"sort_order" >= 0`)
@Check(
  'CHK_categories_archive_state',
  `(is_archived = false AND archived_at IS NULL) OR (is_archived = true AND archived_at IS NOT NULL)`,
)
export class CategoryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  user_id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  display_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 20 })
  type: CategoryType;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color_token: ColorToken | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon_key: IconKey | null;

  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @Column({ type: 'boolean', default: true })
  include_in_reports: boolean;

  @Column({ type: 'boolean', default: false })
  is_archived: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  archived_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  sort_order: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => UserOrmEntity, user => user.categories, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_categories_user',
  })
  user: UserOrmEntity;

  @OneToMany(() => Transaction, transaction => transaction.category)
  transactions: Transaction[];
}
