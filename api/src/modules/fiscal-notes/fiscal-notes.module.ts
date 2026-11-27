import fiscalNotesConfig from '@/config/fiscal-notes.config';
import {
  IFiscalNoteCache,
  IFiscalNoteProviderRegistry,
  IFiscalNoteRateLimiter,
} from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import { GetFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-fiscal-note/get-fiscal-note.use-case';
import { GetTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.use-case';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import { LinkFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.use-case';
import { ListFiscalNotesUseCase } from '@/modules/fiscal-notes/application/use-cases/list-fiscal-notes/list-fiscal-notes.use-case';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import { UnlinkTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.use-case';
import { FISCAL_NOTE_PROVIDERS_TOKEN } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNotesCoreModule } from '@/modules/fiscal-notes/fiscal-notes-core.module';
import { RedisFiscalNoteCache } from '@/modules/fiscal-notes/infrastructure/cache/redis-fiscal-note.cache';
import { FiscalNoteProviderRegistry } from '@/modules/fiscal-notes/infrastructure/providers/fiscal-note-provider.registry';
import { SefazCeHtmlParser } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce-html.parser';
import { SefazCeHttpClient } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.http-client';
import { SefazCeProvider } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.provider';
import { RedisFiscalNoteRateLimiter } from '@/modules/fiscal-notes/infrastructure/rate-limit/redis-fiscal-note-rate-limiter';
import { FiscalNotesController } from '@/modules/fiscal-notes/presentation/http/fiscal-notes.controller';
import { TransactionFiscalNoteController } from '@/modules/fiscal-notes/presentation/http/transaction-fiscal-note.controller';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { CircuitBreakerModule } from '@/shared/circuit-breaker';
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Module({
  imports: [
    FiscalNotesCoreModule,
    TransactionsModule,
    CircuitBreakerModule,
    NestConfigModule.forFeature(fiscalNotesConfig),
  ],
  controllers: [FiscalNotesController, TransactionFiscalNoteController],
  providers: [
    SefazCeHttpClient,
    SefazCeHtmlParser,
    SefazCeProvider,
    {
      provide: FISCAL_NOTE_PROVIDERS_TOKEN,
      inject: [SefazCeProvider],
      useFactory: (sefazCeProvider: SefazCeProvider) => [sefazCeProvider],
    },
    {
      provide: IFiscalNoteProviderRegistry,
      useClass: FiscalNoteProviderRegistry,
    },
    {
      provide: IFiscalNoteCache,
      useClass: RedisFiscalNoteCache,
    },
    {
      provide: IFiscalNoteRateLimiter,
      useClass: RedisFiscalNoteRateLimiter,
    },
    FiscalNoteQueryService,
    ListFiscalNotesUseCase,
    GetFiscalNoteUseCase,
    PreviewFiscalNoteUseCase,
    ImportFiscalNoteUseCase,
    LinkFiscalNoteUseCase,
    GetTransactionFiscalNoteUseCase,
    UnlinkTransactionFiscalNoteUseCase,
  ],
  exports: [
    FiscalNoteQueryService,
    ListFiscalNotesUseCase,
    GetFiscalNoteUseCase,
    PreviewFiscalNoteUseCase,
    ImportFiscalNoteUseCase,
    LinkFiscalNoteUseCase,
    GetTransactionFiscalNoteUseCase,
    UnlinkTransactionFiscalNoteUseCase,
  ],
})
export class FiscalNotesModule {}
