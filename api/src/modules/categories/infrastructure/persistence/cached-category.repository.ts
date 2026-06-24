import { CategoryType, ColorToken, IconKey } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { RedisService } from '@/database/redis/redis.service';
import { Category } from '@/modules/categories/domain/entities/category.entity';
import {
  ICategoryRepository,
  ListManagementCategoriesInput,
  ListManagementCategoriesOutput,
} from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable } from '@nestjs/common';
import { CategoryRepository } from './category.repository';

interface CachedCategory {
  id: string;
  userId: string;
  name: string;
  displayName: string;
  description: string | null;
  type: CategoryType;
  colorToken: ColorToken | null;
  iconKey: IconKey | null;
  isSystem: boolean;
  includeInReports: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class CachedCategoryRepository implements ICategoryRepository {
  private readonly cacheTtl = 1000 * 60 * 5;

  constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly cache: RedisService,
  ) {}

  async findByIdAndUserId(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<Category | null> {
    if (options?.manager) {
      return this.categoryRepository.findByIdAndUserId(categoryId, userId, { manager: options.manager });
    }

    const cacheKey = CacheKeys.categories.byId(categoryId);
    const cached = await this.cache.get<CachedCategory>(cacheKey);

    if (cached) {
      if (cached.userId !== userId) {
        return null;
      }

      return this.hydrateCategory(cached);
    }

    const category = await this.categoryRepository.findByIdAndUserId(categoryId, userId);

    if (!category) {
      return null;
    }

    await this.cache.set(cacheKey, this.serializeCategory(category), this.cacheTtl);

    return category;
  }

  async listByUserId(userId: string, includeArchived: boolean, options?: IRepositoryOptions): Promise<Category[]> {
    if (options?.manager) {
      return this.categoryRepository.listByUserId(userId, includeArchived, { manager: options.manager });
    }

    const cacheKey = CacheKeys.categories.listByUserId(userId, includeArchived);
    const cached = await this.cache.get<CachedCategory[]>(cacheKey);

    if (cached) {
      return cached.map(category => this.hydrateCategory(category));
    }

    const categories = await this.categoryRepository.listByUserId(userId, includeArchived);
    const serializedCategories = categories.map(category => this.serializeCategory(category));

    await Promise.all([
      this.cache.set(cacheKey, serializedCategories, this.cacheTtl),
      ...serializedCategories.map(category =>
        this.cache.set(CacheKeys.categories.byId(category.id), category, this.cacheTtl),
      ),
    ]);

    return categories;
  }

  async listByUserIdAndType(
    userId: string,
    type: CategoryType,
    includeArchived: boolean,
    options?: IRepositoryOptions,
  ): Promise<Category[]> {
    if (options?.manager) {
      return this.categoryRepository.listByUserIdAndType(userId, type, includeArchived, { manager: options.manager });
    }

    const cacheKey = CacheKeys.categories.listByUserIdAndType(userId, type, includeArchived);
    const cached = await this.cache.get<CachedCategory[]>(cacheKey);

    if (cached) {
      return cached.map(category => this.hydrateCategory(category));
    }

    const categories = await this.categoryRepository.listByUserIdAndType(userId, type, includeArchived);
    const serializedCategories = categories.map(category => this.serializeCategory(category));

    await Promise.all([
      this.cache.set(cacheKey, serializedCategories, this.cacheTtl),
      ...serializedCategories.map(category =>
        this.cache.set(CacheKeys.categories.byId(category.id), category, this.cacheTtl),
      ),
    ]);

    return categories;
  }

  async listManagementCategories(
    input: ListManagementCategoriesInput,
    options?: IRepositoryOptions,
  ): Promise<ListManagementCategoriesOutput> {
    return this.categoryRepository.listManagementCategories(input, options);
  }

  async findActiveByNameAndType(
    userId: string,
    type: CategoryType,
    name: string,
    options?: IRepositoryOptions,
  ): Promise<Category | null> {
    if (options?.manager) {
      return this.categoryRepository.findActiveByNameAndType(userId, type, name, { manager: options.manager });
    }

    const categories = await this.listByUserIdAndType(userId, type, false);

    return categories.find(category => category.name === name) ?? null;
  }

  async findActiveSystemByType(
    userId: string,
    type: CategoryType,
    options?: IRepositoryOptions,
  ): Promise<Category | null> {
    if (options?.manager) {
      return this.categoryRepository.findActiveSystemByType(userId, type, { manager: options.manager });
    }

    const categories = await this.listByUserIdAndType(userId, type, false);

    return categories.find(category => category.isSystem) ?? null;
  }

  async existsActiveByNameAndType(
    userId: string,
    type: CategoryType,
    name: string,
    excludeCategoryId?: string,
    options?: IRepositoryOptions,
  ): Promise<boolean> {
    if (options?.manager) {
      return this.categoryRepository.existsActiveByNameAndType(userId, type, name, excludeCategoryId, {
        manager: options.manager,
      });
    }

    const category = await this.findActiveByNameAndType(userId, type, name);

    if (!category) {
      return false;
    }

    return category.id !== excludeCategoryId;
  }

  async hasTransactions(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<boolean> {
    return this.categoryRepository.hasTransactions(categoryId, userId, options);
  }

  async moveTransactionsToCategory(
    sourceCategoryId: string,
    targetCategoryId: string,
    userId: string,
    options?: IRepositoryOptions,
  ): Promise<void> {
    await this.categoryRepository.moveTransactionsToCategory(sourceCategoryId, targetCategoryId, userId, options);
  }

  async save(category: Category, options?: IRepositoryOptions): Promise<Category> {
    const saved = await this.categoryRepository.save(category, options);

    await this.invalidateUserCategoryCache(saved.userId, options);
    await this.cache.set(CacheKeys.categories.byId(saved.id), this.serializeCategory(saved), this.cacheTtl);

    return saved;
  }

  async delete(categoryId: string, userId: string, options?: IRepositoryOptions): Promise<void> {
    const category = await this.categoryRepository.findByIdAndUserId(categoryId, userId, options);

    await this.categoryRepository.delete(categoryId, userId, options);

    if (category) {
      await this.invalidateUserCategoryCache(category.userId, options);
    }

    await this.cache.del(CacheKeys.categories.byId(categoryId));
  }

  private serializeCategory(category: Category): CachedCategory {
    return {
      id: category.id,
      userId: category.userId,
      name: category.name,
      displayName: category.displayName,
      description: category.description,
      type: category.type,
      colorToken: category.colorToken,
      iconKey: category.iconKey,
      isSystem: category.isSystem,
      includeInReports: category.includeInReports,
      isArchived: category.isArchived,
      archivedAt: category.archivedAt?.toISOString() ?? null,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private hydrateCategory(cached: CachedCategory): Category {
    return Category.reconstitute(
      {
        userId: cached.userId,
        name: cached.name,
        displayName: cached.displayName,
        description: cached.description,
        type: cached.type,
        colorToken: cached.colorToken,
        iconKey: cached.iconKey,
        isSystem: cached.isSystem,
        includeInReports: cached.includeInReports,
        isArchived: cached.isArchived,
        archivedAt: cached.archivedAt ? new Date(cached.archivedAt) : null,
        sortOrder: cached.sortOrder,
        createdAt: new Date(cached.createdAt),
        updatedAt: new Date(cached.updatedAt),
      },
      cached.id,
    );
  }

  private async invalidateUserCategoryCache(userId: string, options?: IRepositoryOptions): Promise<void> {
    const categories = await this.categoryRepository.listByUserId(userId, true, options);
    const categoryTypes = Object.values(CategoryType);

    await Promise.all([
      this.cache.del(CacheKeys.categories.listByUserId(userId, false)),
      this.cache.del(CacheKeys.categories.listByUserId(userId, true)),
      ...categoryTypes.flatMap(type => [
        this.cache.del(CacheKeys.categories.listByUserIdAndType(userId, type, false)),
        this.cache.del(CacheKeys.categories.listByUserIdAndType(userId, type, true)),
      ]),
      ...categories.map(category => this.cache.del(CacheKeys.categories.byId(category.id))),
    ]);
  }
}
