import { ApiProperty } from '@nestjs/swagger';
import { ListCategoriesUseCaseOutput } from '@/modules/categories/application/use-cases/list-categories/list-categories.dto';
import { CategoryResponseDto } from './category.response.dto';

class ListCategoriesMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}

export class ListCategoriesResponseDto {
  @ApiProperty({ type: [CategoryResponseDto] })
  data: CategoryResponseDto[];

  @ApiProperty({ type: ListCategoriesMetaDto })
  meta: ListCategoriesMetaDto;

  static fromUseCaseOutput(output: ListCategoriesUseCaseOutput): ListCategoriesResponseDto {
    return {
      data: output.items.map(category => CategoryResponseDto.fromDomain(category)),
      meta: {
        total: output.total,
        page: output.page,
        limit: output.limit,
        totalPages: output.totalPages,
        hasNextPage: output.hasNextPage,
        hasPreviousPage: output.hasPreviousPage,
      },
    };
  }
}
