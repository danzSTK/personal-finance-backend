import {
  GetCategoryUseCaseInput,
  GetCategoryUseCaseOutput,
} from '@/modules/categories/application/use-cases/get-category/get-category.dto';
import { ICategoryRepository } from '@/modules/categories/domain/repositories/category.repository.interface';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class GetCategoryUseCase {
  constructor(private readonly categoryRepository: ICategoryRepository) {}

  async execute(data: GetCategoryUseCaseInput): Promise<GetCategoryUseCaseOutput> {
    const category = await this.categoryRepository.findByIdAndUserId(data.categoryId, data.userId);

    if (!category || category.isSystem || !category.isVisibleInManagement) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }
}
