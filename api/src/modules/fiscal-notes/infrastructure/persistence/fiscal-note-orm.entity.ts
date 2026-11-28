import { FiscalNoteItemOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-item-orm.entity';
import { FiscalNotePaymentOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-payment-orm.entity';
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

@Entity('fiscal_notes')
@Index('UQ_fiscal_notes_user_access_key_active', ['userId', 'accessKey'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('UQ_fiscal_notes_transaction_active', ['transactionId'], {
  unique: true,
  where: 'deleted_at IS NULL',
})
@Index('idx_fiscal_notes_user_id', ['userId'])
@Index('idx_fiscal_notes_user_issued_at_active', ['userId', 'issuedAt'], {
  where: 'deleted_at IS NULL',
})
@Index('idx_fiscal_notes_transaction_id', ['transactionId'])
@Check('CHK_fiscal_notes_access_key_digits', `"access_key" ~ '^[0-9]{44}$'`)
@Check('CHK_fiscal_notes_source_uf_digits', `"source_uf" ~ '^[0-9]{2}$'`)
@Check('CHK_fiscal_notes_issuer_cnpj_digits', `"issuer_cnpj" ~ '^[0-9]{14}$'`)
@Check('CHK_fiscal_notes_gross_amount_cents', `"gross_amount_cents" >= 0`)
@Check('CHK_fiscal_notes_discount_amount_cents', `"discount_amount_cents" >= 0`)
@Check('CHK_fiscal_notes_payable_amount_cents', `"payable_amount_cents" >= 0`)
@Check('CHK_fiscal_notes_tax_amount_cents', `"tax_amount_cents" >= 0`)
@Check('CHK_fiscal_notes_change_amount_cents', `"change_amount_cents" IS NULL OR "change_amount_cents" >= 0`)
export class FiscalNoteOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Column({ name: 'access_key', type: 'char', length: 44 })
  accessKey!: string;

  @Column({ name: 'source_uf', type: 'char', length: 2 })
  sourceUf!: string;

  @Column({ type: 'varchar', length: 20 })
  number!: string;

  @Column({ type: 'varchar', length: 10 })
  series!: string;

  @Column({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  protocol!: string | null;

  @Column({ name: 'issuer_name', type: 'varchar', length: 255 })
  issuerName!: string;

  @Column({ name: 'issuer_cnpj', type: 'char', length: 14 })
  issuerCnpj!: string;

  @Column({ name: 'issuer_address', type: 'text', nullable: true })
  issuerAddress!: string | null;

  @Column({ name: 'gross_amount_cents', type: 'bigint' })
  grossAmountCents!: string;

  @Column({ name: 'discount_amount_cents', type: 'bigint', default: '0' })
  discountAmountCents!: string;

  @Column({ name: 'payable_amount_cents', type: 'bigint' })
  payableAmountCents!: string;

  @Column({ name: 'tax_amount_cents', type: 'bigint', default: '0' })
  taxAmountCents!: string;

  @Column({ name: 'change_amount_cents', type: 'bigint', nullable: true })
  changeAmountCents!: string | null;

  @Column({ name: 'xml_version', type: 'varchar', length: 16, nullable: true })
  xmlVersion!: string | null;

  @Column({ name: 'xslt_version', type: 'varchar', length: 16, nullable: true })
  xsltVersion!: string | null;

  @Column({ name: 'parser_version', type: 'varchar', length: 32 })
  parserVersion!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => UserOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'FK_fiscal_notes_user' })
  user?: UserOrmEntity;

  @ManyToOne(() => TransactionOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'FK_fiscal_notes_transaction' })
  transaction?: TransactionOrmEntity;

  @OneToMany(() => FiscalNoteItemOrmEntity, item => item.fiscalNote, { cascade: false })
  items?: FiscalNoteItemOrmEntity[];

  @OneToMany(() => FiscalNotePaymentOrmEntity, payment => payment.fiscalNote, { cascade: false })
  payments?: FiscalNotePaymentOrmEntity[];
}
