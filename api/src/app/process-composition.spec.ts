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
import { ApiModule } from '@/app/api/api.module';
import { WorkerModule } from '@/app/worker/worker.module';
import { WorkerEventConsumersModule } from '@/app/worker/composition/worker-event-consumers.module';
import { AccountsEventHandlersModule } from '@/modules/accounts/accounts-event-handlers.module';
import { AssetsEventHandlersModule } from '@/modules/assets/assets-event-handlers.module';
import { AuthEventHandlersModule } from '@/modules/auth/auth-event-handlers.module';
import { CategoriesEventHandlersModule } from '@/modules/categories/categories-event-handlers.module';
import { NotificationsEventHandlersModule } from '@/modules/notifications/notifications-event-handlers.module';
import { UsersEventsModule } from '@/modules/users/users-events.module';
import { UserCreatedEventHydrator } from '@/modules/users/infrastructure/events/user-created-event.rehydrator';
import { UserEmailVerifiedEventHydrator } from '@/modules/users/infrastructure/events/user-email-verified-event.rehydrator';
import { UserAvatarUpdatedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-updated-event.rehydrator';
import { UserAvatarRemovedEventHydrator } from '@/modules/users/infrastructure/events/user-avatar-removed-event.rehydrator';

describe('Process composition', () => {
  const importsOf = (moduleType: object): unknown[] => {
    return (Reflect.getMetadata(MODULE_METADATA.IMPORTS, moduleType) as unknown[] | undefined) ?? [];
  };

  it('keeps worker-only processors out of the API root', () => {
    const imports = importsOf(ApiModule);

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

  it('registers the complete event-handler module catalog in the worker', () => {
    expect(importsOf(WorkerEventConsumersModule)).toEqual([
      AccountsEventHandlersModule,
      AssetsEventHandlersModule,
      AuthEventHandlersModule,
      CategoriesEventHandlersModule,
      NotificationsEventHandlersModule,
    ]);
  });

  it('exports the complete outbox hydrator catalog used by the worker', () => {
    const exports = (Reflect.getMetadata(MODULE_METADATA.EXPORTS, UsersEventsModule) as unknown[] | undefined) ?? [];

    expect(exports).toEqual([
      UserCreatedEventHydrator,
      UserEmailVerifiedEventHydrator,
      UserAvatarUpdatedEventHydrator,
      UserAvatarRemovedEventHydrator,
    ]);
  });
});
