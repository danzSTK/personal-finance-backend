import { CategoryType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { Transaction } from '@/entities/transaction.entity';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import {
  ICategoryRepository,
  ListManagementCategoriesInput,
  ListManagementCategoriesOutput,
} from '@/modules/categories/domain/repositories/category.repository.interface';
import { CategoryMapper } from '@/modules/categories/infrastructure/mappers/category.mapper';
import { CategoryOrmEntity } from '@/modules/categories/infrastructure/persistence/model/category.entity';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

function escapeLikePattern(value: string): string {
  return value.replace(/[!%_]/g, match => `!${match}`);
}

@Injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(
    @InjectRepository(CategoryOrmEntity)
    private readonly categoryRepository: Repository<CategoryOrmEntity>,
  ) {}

  async findByIdAndUserId(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<Category | null> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;

    const category = await repository.findOne({
      where: {
        id: categoryId,
        user_id: userId,
      },
    });

    if (!category) {
      return null;
    }

    return CategoryMapper.toDomain(category);
  }

  async listByUserId(userId: string, includeArchived: boolean, options?: IRepositoryOptions): Promise<Category[]> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;

    const categories = await repository.find({
      where: includeArchived ? { user_id: userId } : { user_id: userId, is_archived: false },
      order: {
        sort_order: 'ASC',
        display_name: 'ASC',
        created_at: 'ASC',
      },
    });

    return categories.map(category => CategoryMapper.toDomain(category));
  }

  async listByUserIdAndType(
    userId: string,
    type: CategoryType,
    includeArchived: boolean,
    options?: IRepositoryOptions,
  ): Promise<Category[]> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;

    const categories = await repository.find({
      where: includeArchived ? { user_id: userId, type } : { user_id: userId, type, is_archived: false },
      order: {
        sort_order: 'ASC',
        display_name: 'ASC',
        created_at: 'ASC',
      },
    });

    return categories.map(category => CategoryMapper.toDomain(category));
  }

  async listManagementCategories(
    input: ListManagementCategoriesInput,
    options?: IRepositoryOptions,
  ): Promise<ListManagementCategoriesOutput> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;
    const offset = (input.page - 1) * input.limit;
    const queryBuilder = repository
      .createQueryBuilder('category')
      .where('category.user_id = :userId', { userId: input.userId })
      .andWhere('category.is_system = false')
      .andWhere('category.type NOT IN (:...technicalTypes)', {
        technicalTypes: [CategoryType.TRANSFER, CategoryType.ADJUSTMENT],
      });

    if (!input.includeArchived) {
      queryBuilder.andWhere('category.is_archived = false');
    }

    if (input.type) {
      queryBuilder.andWhere('category.type = :type', { type: input.type });
    }

    if (input.search) {
      const escapedSearch = `%${escapeLikePattern(input.search)}%`;

      if (input.normalizedSearch) {
        const escapedNormalizedSearch = `%${escapeLikePattern(input.normalizedSearch)}%`;

        queryBuilder.andWhere(
          `(category.display_name ILIKE :search ESCAPE '!' OR category.name LIKE :normalizedSearch ESCAPE '!')`,
          {
            search: escapedSearch,
            normalizedSearch: escapedNormalizedSearch,
          },
        );
      } else {
        queryBuilder.andWhere(`category.display_name ILIKE :search ESCAPE '!'`, {
          search: escapedSearch,
        });
      }
    }

    const [categories, total] = await queryBuilder
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('category.display_name', 'ASC')
      .addOrderBy('category.created_at', 'ASC')
      .skip(offset)
      .take(input.limit)
      .getManyAndCount();

    return {
      items: categories.map(category => CategoryMapper.toDomain(category)),
      total,
    };
  }

  async findActiveByNameAndType(
    userId: string,
    type: CategoryType,
    name: string,
    options?: IRepositoryOptions,
  ): Promise<Category | null> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;

    const category = await repository.findOne({
      where: {
        user_id: userId,
        type,
        name,
        is_archived: false,
      },
    });

    if (!category) {
      return null;
    }

    return CategoryMapper.toDomain(category);
  }

  async existsActiveByNameAndType(
    userId: string,
    type: CategoryType,
    name: string,
    excludeCategoryId?: string,
    options?: IRepositoryOptions,
  ): Promise<boolean> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;

    const queryBuilder = repository
      .createQueryBuilder('category')
      .where('category.user_id = :userId', { userId })
      .andWhere('category.type = :type', { type })
      .andWhere('category.name = :name', { name })
      .andWhere('category.is_archived = false');

    if (excludeCategoryId) {
      queryBuilder.andWhere('category.id <> :excludeCategoryId', { excludeCategoryId });
    }

    const count = await queryBuilder.getCount();

    return count > 0;
  }

  async hasTransactions(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<boolean> {
    const repository = options?.manager
      ? options.manager.getRepository(Transaction)
      : this.categoryRepository.manager.getRepository(Transaction);

    const count = await repository
      .createQueryBuilder('transaction')
      .where('transaction.category_id = :categoryId', { categoryId })
      .andWhere('transaction.user_id = :userId', { userId })
      .getCount();

    return count > 0;
  }

  async moveTransactionsToCategory(
    sourceCategoryId: string,
    targetCategoryId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<void> {
    const repository = options?.manager
      ? options.manager.getRepository(Transaction)
      : this.categoryRepository.manager.getRepository(Transaction);

    await repository
      .createQueryBuilder()
      .update(Transaction)
      .set({ category_id: targetCategoryId })
      .where('category_id = :sourceCategoryId', { sourceCategoryId })
      .andWhere('user_id = :userId', { userId })
      .execute();
  }

  async save(category: Category, options?: IRepositoryOptions): Promise<Category> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;
    const payload = CategoryMapper.toOrm(category);

    await repository.save(payload);

    const saved = await repository.findOne({
      where: {
        id: category.id,
      },
    });

    if (!saved) {
      throw new Error('Category not found after save');
    }

    return CategoryMapper.toDomain(saved);
  }

  async delete(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<void> {
    const repository = options?.manager ? options.manager.getRepository(CategoryOrmEntity) : this.categoryRepository;

    await repository.delete({
      id: categoryId,
      user_id: userId,
    });
  }
}
