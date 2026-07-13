import { Module } from '@nestjs/common';
import { ProvisionDefaultCategoriesOnUserHandler } from './application/handlers/provision-default-categories-on-user.handler';
import { CategoriesCoreModule } from './categories-core.module';

@Module({
  imports: [CategoriesCoreModule],
  providers: [ProvisionDefaultCategoriesOnUserHandler],
})
export class CategoriesEventHandlersModule {}
