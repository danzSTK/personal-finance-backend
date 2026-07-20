import { Module } from '@nestjs/common';
import { ProvisionDefaultAccountOnUserHandler } from './application/handlers/provision-default-account-on-user.handler';
import { AccountsCoreModule } from './accounts-core.module';

@Module({
  imports: [AccountsCoreModule],
  providers: [ProvisionDefaultAccountOnUserHandler],
})
export class AccountsEventHandlersModule {}
