import { CurateInstitutionalAccountTemplatesUseCase } from '@/modules/accounts/application/use-cases/curate-institutional-account-templates/curate-institutional-account-templates.use-case';
import { ConfigModule } from '@/config/config.module';
import { ObjectStorageModule } from '@/shared/object-storage';
import { Module } from '@nestjs/common';

@Module({
  imports: [ConfigModule, ObjectStorageModule],
  providers: [CurateInstitutionalAccountTemplatesUseCase],
})
export class CurateAccountTemplatesCommandModule {}
