import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fiscal_note_items')
@Index('UQ_fiscal_note_items_fiscal_note_position', ['fiscalNoteId', 'position'], { unique: true })
@Check('CHK_fiscal_note_items_position', `"position" >= 1`)
@Check('CHK_fiscal_note_items_quantity', `"quantity" > 0`)
@Check('CHK_fiscal_note_items_unit_price', `"unit_price" >= 0`)
@Check('CHK_fiscal_note_items_total_price_cents', `"total_price_cents" >= 0`)
export class FiscalNoteItemOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'fiscal_note_id', type: 'uuid' })
  fiscalNoteId!: string;

  @Column({ type: 'integer' })
  position!: number;

  @Column({ name: 'raw_description', type: 'varchar', length: 500 })
  rawDescription!: string;

  @Column({ name: 'store_code', type: 'varchar', length: 64, nullable: true })
  storeCode!: string | null;

  @Column({ type: 'varchar', length: 20 })
  unit!: string;

  @Column({ type: 'numeric', precision: 12, scale: 4 })
  quantity!: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 4 })
  unitPrice!: string;

  @Column({ name: 'total_price_cents', type: 'bigint' })
  totalPriceCents!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ManyToOne(() => FiscalNoteOrmEntity, fiscalNote => fiscalNote.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fiscal_note_id', foreignKeyConstraintName: 'FK_fiscal_note_items_fiscal_note' })
  fiscalNote?: FiscalNoteOrmEntity;
}
