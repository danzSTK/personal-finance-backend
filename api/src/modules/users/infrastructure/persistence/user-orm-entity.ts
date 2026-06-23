import { UserStatus } from '@/common/models/enums';
import { Transaction } from '@/entities/transaction.entity';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/model/category.entity';
import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { AuthProviderOrmEntity } from './auth-provider-orm.entity';

@Entity('users')
@Index('idx_users_status', ['status'])
@Index('idx_users_email', ['email'], { unique: true })
@Check('CHK_users_status', `"status" IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED')`)
@Unique('UQ_user_name', ['userName'])
@Unique('UQ_users_avatar_asset_id', ['avatarAssetId'])
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  email!: string;

  @Column({
    name: 'user_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  userName!: string | null;

  @Column({
    name: 'first_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  firstName!: string | null;

  @Column({
    name: 'last_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    default: null,
  })
  lastName!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: false,
    default: UserStatus.PENDING_PROFILE,
  })
  status!: UserStatus;

  @Column({ name: 'avatar_asset_id', type: 'uuid', nullable: true })
  avatarAssetId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => AccountOrmEntity, account => account.user)
  accounts!: AccountOrmEntity[];

  @OneToMany(() => CategoryOrmEntity, category => category.user)
  categories!: CategoryOrmEntity[];

  @OneToMany(() => AssetOrmEntity, asset => asset.user)
  assets!: AssetOrmEntity[];

  @OneToOne(() => AssetOrmEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'avatar_asset_id', foreignKeyConstraintName: 'FK_users_avatar_asset' })
  avatarAsset!: AssetOrmEntity | null;

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions!: Transaction[];

  @OneToMany(() => AuthProviderOrmEntity, authProvider => authProvider.user, { cascade: ['insert', 'update'] })
  authProviders!: AuthProviderOrmEntity[];
}
