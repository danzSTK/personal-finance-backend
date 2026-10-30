import { AssetOrmEntity } from '@/modules/assets/infrastructure/persistence/asset-orm.entity';
import { TransactionOrmEntity } from '@/modules/transactions/infrastructure/persistence/transaction-orm.entity';
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

@Entity('transaction_attachments')
@Index('idx_transaction_attachments_transaction_position', ['transactionId', 'position'])
@Index('UQ_transaction_attachments_transaction_asset', ['transactionId', 'assetId'], { unique: true })
@Index('UQ_transaction_attachments_transaction_position', ['transactionId', 'position'], { unique: true })
@Check('CHK_transaction_attachments_position', `"position" >= 0 AND "position" <= 2`)
export class TransactionAttachmentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'transaction_id' })
  transactionId!: string;

  @Column('uuid', { name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'smallint' })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => TransactionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'transaction_id',
    foreignKeyConstraintName: 'FK_transaction_attachments_transaction',
  })
  transaction?: TransactionOrmEntity;

  @ManyToOne(() => AssetOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'asset_id',
    foreignKeyConstraintName: 'FK_transaction_attachments_asset',
  })
  asset?: AssetOrmEntity;
}
