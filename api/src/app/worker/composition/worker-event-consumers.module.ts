import { AssetsEventHandlersModule } from '@/modules/assets/assets-event-handlers.module';
import { AccountsEventHandlersModule } from '@/modules/accounts/accounts-event-handlers.module';
import { AuthEventHandlersModule } from '@/modules/auth/auth-event-handlers.module';
import { CategoriesEventHandlersModule } from '@/modules/categories/categories-event-handlers.module';
import { NotificationsEventHandlersModule } from '@/modules/notifications/notifications-event-handlers.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    AccountsEventHandlersModule,
    AssetsEventHandlersModule,
    AuthEventHandlersModule,
    CategoriesEventHandlersModule,
    NotificationsEventHandlersModule,
  ],
})
export class WorkerEventConsumersModule {}
