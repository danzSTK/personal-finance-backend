import { Module } from '@nestjs/common';
import { CategoriesCoreModule } from './categories-core.module';
import { CategoriesController } from './presentation/http/categories.controller';

@Module({
  imports: [CategoriesCoreModule],
  controllers: [CategoriesController],
  exports: [CategoriesCoreModule],
})
export class CategoriesModule {}
