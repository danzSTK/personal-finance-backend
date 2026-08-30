import { Module } from '@nestjs/common';
import { AccountsCoreModule } from './accounts-core.module';
import { AccountsController } from './presentation/http/accounts.controller';
import { AccountTemplatesController } from './presentation/http/account-templates.controller';
import { AccountTemplateResponseAssembler } from './presentation/services/account-template-response.assembler';
import { ObjectStorageModule } from '@/shared/object-storage';

@Module({
  imports: [AccountsCoreModule, ObjectStorageModule],
  controllers: [AccountsController, AccountTemplatesController],
  providers: [AccountTemplateResponseAssembler],
  exports: [AccountsCoreModule],
})
export class AccountsModule {}
