import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArchiveCategoryUseCase } from './application/use-cases/archive-category/archive-category.use-case';
import { CreateCategoryUseCase } from './application/use-cases/create-category/create-category.use-case';
import { DeleteCategoryWithMergeUseCase } from './application/use-cases/delete-category-with-merge/delete-category-with-merge.use-case';
import { DeleteCategoryUseCase } from './application/use-cases/delete-category/delete-category.use-case';
import { GetCategoryMetadataUseCase } from './application/use-cases/get-category-metadata/get-category-metadata.use-case';
import { GetCategoryUseCase } from './application/use-cases/get-category/get-category.use-case';
import { ListCategoriesUseCase } from './application/use-cases/list-categories/list-categories.use-case';
import { UnarchiveCategoryUseCase } from './application/use-cases/unarchive-category/unarchive-category.use-case';
import { UpdateCategoryUseCase } from './application/use-cases/update-category/update-category.use-case';
import { ICategoryRepository } from './domain/repositories/category.repository.interface';
import { CachedCategoryRepository } from './infrastructure/persistence/cached-category.repository';
import { CategoryRepository } from './infrastructure/persistence/category.repository';
import { CategoryOrmEntity } from './infrastructure/persistence/model/category.entity';
import { CategoriesController } from './presentation/http/categories.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryOrmEntity])],
  controllers: [CategoriesController],
  providers: [
    {
      provide: ICategoryRepository,
      useClass: CachedCategoryRepository,
    },
    CategoryRepository,
    CreateCategoryUseCase,
    ListCategoriesUseCase,
    GetCategoryUseCase,
    UpdateCategoryUseCase,
    ArchiveCategoryUseCase,
    UnarchiveCategoryUseCase,
    DeleteCategoryUseCase,
    DeleteCategoryWithMergeUseCase,
    GetCategoryMetadataUseCase,
  ],
  exports: [
    ICategoryRepository,
    CreateCategoryUseCase,
    ListCategoriesUseCase,
    GetCategoryUseCase,
    UpdateCategoryUseCase,
    ArchiveCategoryUseCase,
    UnarchiveCategoryUseCase,
    DeleteCategoryUseCase,
    DeleteCategoryWithMergeUseCase,
    GetCategoryMetadataUseCase,
  ],
})
export class CategoriesModule {}
