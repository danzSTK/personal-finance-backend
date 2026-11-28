import { FiscalNoteTransactionLifecyclePort } from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteTransactionLifecycleAdapter } from '@/modules/fiscal-notes/application/services/fiscal-note-transaction-lifecycle.adapter';
import { IFiscalNoteRepository } from '@/modules/fiscal-notes/domain/repositories';
import { FiscalNoteItemOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-item-orm.entity';
import { FiscalNoteOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-orm.entity';
import { FiscalNotePaymentOrmEntity } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note-payment-orm.entity';
import { FiscalNoteRepository } from '@/modules/fiscal-notes/infrastructure/persistence/fiscal-note.repository';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([FiscalNoteOrmEntity, FiscalNoteItemOrmEntity, FiscalNotePaymentOrmEntity])],
  providers: [
    { provide: IFiscalNoteRepository, useClass: FiscalNoteRepository },
    { provide: FiscalNoteTransactionLifecyclePort, useClass: FiscalNoteTransactionLifecycleAdapter },
  ],
  exports: [IFiscalNoteRepository, FiscalNoteTransactionLifecyclePort],
})
export class FiscalNotesCoreModule {}
