import type { AccountTemplateColorTokenValue } from '@/modules/accounts/domain/value-objects/account-template-color-token.value-object';
import type { AccountTemplateType } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { IconKey } from '@/common/models/enums';
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
import { AccountOrmEntity } from './account.entity';

@Entity('account_templates')
@Index('UQ_account_templates_catalog_key', ['catalog_key'], {
  unique: true,
  where: 'catalog_key IS NOT NULL',
})
@Index('UQ_account_templates_bank_code', ['bank_code'], {
  unique: true,
  where: "template_type = 'INSTITUTIONAL'",
})
@Index('UQ_account_templates_ispb', ['ispb'], {
  unique: true,
  where: "template_type = 'INSTITUTIONAL'",
})
@Index('idx_account_templates_owner_user_id', ['owner_user_id'], {
  where: "template_type = 'CUSTOM'",
})
@Check('CHK_account_templates_type', `"template_type" IN ('INSTITUTIONAL', 'CUSTOM')`)
@Check(
  'CHK_account_templates_owner',
  `("template_type" = 'INSTITUTIONAL' AND "owner_user_id" IS NULL) OR ("template_type" = 'CUSTOM' AND "owner_user_id" IS NOT NULL)`,
)
@Check(
  'CHK_account_templates_institutional_metadata',
  `("template_type" = 'INSTITUTIONAL' AND "catalog_key" IS NOT NULL AND "color_token" IS NOT NULL AND "icon_key" IS NULL AND "logo_storage_key" IS NOT NULL AND "bank_code" IS NOT NULL AND "ispb" IS NOT NULL) OR ("template_type" = 'CUSTOM' AND "catalog_key" IS NULL AND "logo_storage_key" IS NULL AND "bank_code" IS NULL AND "ispb" IS NULL)`,
)
@Check(
  'CHK_account_templates_storage_key',
  `"logo_storage_key" IS NULL OR ("logo_storage_key" <> '' AND "logo_storage_key" NOT LIKE '/%')`,
)
@Check('CHK_account_templates_ispb', `"ispb" IS NULL OR "ispb" ~ '^[0-9]{8}$'`)
@Check('CHK_account_templates_bank_code', `"bank_code" IS NULL OR "bank_code" BETWEEN 1 AND 999`)
export class AccountTemplateOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  template_type: AccountTemplateType;

  @Column('uuid', { nullable: true })
  owner_user_id: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  catalog_key: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  color_token: AccountTemplateColorTokenValue | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon_key: IconKey | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  logo_storage_key: string | null;

  @Column({ type: 'smallint', nullable: true })
  bank_code: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  ispb: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'owner_user_id', foreignKeyConstraintName: 'FK_account_templates_owner_user' })
  owner: UserOrmEntity | null;

  @OneToMany(() => AccountOrmEntity, account => account.template)
  accounts: AccountOrmEntity[];
}
