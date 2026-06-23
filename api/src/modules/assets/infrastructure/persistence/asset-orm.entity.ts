import { AssetPurpose, AssetStatus } from '@/modules/assets/domain/enums';
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

@Entity('assets')
@Index('UQ_assets_bucket_storage_key', ['bucket', 'storageKey'], { unique: true })
@Index('idx_assets_user_purpose_status', ['userId', 'purpose', 'status'])
@Index('idx_assets_status_updated_at', ['status', 'updatedAt'], {
  where: `"status" IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED')`,
})
@Check('CHK_assets_purpose', `"purpose" IN ('USER_AVATAR')`)
@Check('CHK_assets_status', `"status" IN ('PENDING_UPLOAD', 'READY', 'DELETE_PENDING', 'DELETED', 'FAILED')`)
@Check('CHK_assets_bucket_not_empty', `length(btrim("bucket")) > 0`)
@Check('CHK_assets_storage_key', `length(btrim("storage_key")) > 0 AND left("storage_key", 1) <> '/'`)
@Check('CHK_assets_size_bytes', `"size_bytes" IS NULL OR "size_bytes" >= 0`)
@Check('CHK_assets_checksum', `"checksum" IS NULL OR "checksum" ~ '^[0-9a-f]{64}$'`)
@Check('CHK_assets_metadata', `jsonb_typeof("metadata") = 'object'`)
@Check('CHK_assets_ready_state', `"status" <> 'READY' OR "ready_at" IS NOT NULL`)
@Check(
  'CHK_assets_deleted_state',
  `("status" = 'DELETED' AND "deleted_at" IS NOT NULL) OR ("status" <> 'DELETED' AND "deleted_at" IS NULL)`,
)
@Check(
  'CHK_assets_failure_state',
  `("status" = 'FAILED' AND "failure_code" IS NOT NULL) OR ("status" <> 'FAILED' AND "failure_code" IS NULL)`,
)
export class AssetOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 50 })
  purpose!: AssetPurpose;

  @Column({ type: 'varchar', length: 30, default: AssetStatus.PENDING_UPLOAD })
  status!: AssetStatus;

  @Column({ type: 'varchar', length: 63 })
  bucket!: string;

  @Column({ name: 'storage_key', type: 'varchar', length: 1024 })
  storageKey!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 255, nullable: true })
  contentType!: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  checksum!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true })
  failureCode!: string | null;

  @Column({ name: 'ready_at', type: 'timestamptz', nullable: true })
  readyAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserOrmEntity, user => user.assets, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_assets_user' })
  user!: UserOrmEntity;
}
