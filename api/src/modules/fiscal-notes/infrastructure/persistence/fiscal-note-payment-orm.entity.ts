import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fiscal_note_payments')
@Index('UQ_fiscal_note_payments_fiscal_note_position', ['fiscalNoteId', 'position'], { unique: true })
@Check('CHK_fiscal_note_payments_position', `"position" >= 1`)
@Check('CHK_fiscal_note_payments_amount_cents', `"amount_cents" >= 0`)
export class FiscalNotePaymentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fiscal_note_id', type: 'uuid' })
  fiscalNoteId!: string;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ name: 'method_label', type: 'varchar', length: 120 })
  methodLabel!: string;

  @Column({ name: 'amount_cents', type: 'bigint' })
  amountCents!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => FiscalNoteOrmEntity, fiscalNote => fiscalNote.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fiscal_note_id', foreignKeyConstraintName: 'FK_fiscal_note_payments_fiscal_note' })
  fiscalNote?: FiscalNoteOrmEntity;
}
