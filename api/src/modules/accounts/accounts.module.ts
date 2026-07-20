import { Module } from '@nestjs/common';
import { AccountsCoreModule } from './accounts-core.module';
import { AccountsController } from './presentation/http/accounts.controller';

@Module({
  imports: [AccountsCoreModule],
  controllers: [AccountsController],
  exports: [AccountsCoreModule],
})
export class AccountsModule {}
