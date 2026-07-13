import { NotificationsWorkerModule } from '@/modules/notifications/notifications-worker.module';
import { AccountsCoreModule } from '@/modules/accounts/accounts-core.module';
import { UnarchiveAccountUseCase } from '@/modules/accounts/application/use-cases/unarchive-account/unarchive-account.use-case';
import { UpdateAccountUseCase } from '@/modules/accounts/application/use-cases/update-account/update-account.use-case';
import {
  OutboxDispatcherModule,
  OutboxModule,
  OutboxPersistenceModule,
  OutboxRegistryModule,
  OutboxWriterModule,
} from '@/shared/outbox';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module';
import { WorkerModule } from './worker.module';

describe('Process composition', () => {
  const importsOf = (moduleType: object): unknown[] => {
    return (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) as unknown[] | undefined) ?? [];
  };

  it('keeps worker-only processors out of the API root', () => {
    const imports = importsOf(AppModule);

    expect(imports).not.toContain(OutboxDispatcherModule);
    expect(imports).not.toContain(NotificationsWorkerModule);
  });

  it('registers outbox and notification consumers in the worker root', () => {
    const imports = importsOf(WorkerModule);

    expect(imports).toContain(OutboxDispatcherModule);
    expect(imports).toContain(NotificationsWorkerModule);
  });

  it('keeps the outbox writer free of dispatcher and registry activation', () => {
    expect(importsOf(OutboxModule)).toEqual([OutboxWriterModule]);
    expect(importsOf(OutboxWriterModule)).toEqual([OutboxPersistenceModule]);
    expect(importsOf(OutboxWriterModule)).not.toContain(OutboxDispatcherModule);
    expect(importsOf(OutboxWriterModule)).not.toContain(OutboxRegistryModule);
  });

  it('exports every account use case consumed by the HTTP facade', () => {
    const exports = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, AccountsCoreModule) as unknown[] | undefined) ?? [];

    expect(exports).toEqual(expect.arrayContaining([UnarchiveAccountUseCase, UpdateAccountUseCase]));
  });
});
