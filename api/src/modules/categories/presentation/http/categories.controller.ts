import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { ArchiveCategoryUseCase } from '@/modules/categories/application/use-cases/archive-category/archive-category.use-case';
import { CreateCategoryUseCase } from '@/modules/categories/application/use-cases/create-category/create-category.use-case';
import { DeleteCategoryWithMergeUseCase } from '@/modules/categories/application/use-cases/delete-category-with-merge/delete-category-with-merge.use-case';
import { DeleteCategoryUseCase } from '@/modules/categories/application/use-cases/delete-category/delete-category.use-case';
import { GetCategoryMetadataUseCase } from '@/modules/categories/application/use-cases/get-category-metadata/get-category-metadata.use-case';
import { GetCategoryUseCase } from '@/modules/categories/application/use-cases/get-category/get-category.use-case';
import { ListCategoriesUseCase } from '@/modules/categories/application/use-cases/list-categories/list-categories.use-case';
import { UnarchiveCategoryUseCase } from '@/modules/categories/application/use-cases/unarchive-category/unarchive-category.use-case';
import { UpdateCategoryUseCase } from '@/modules/categories/application/use-cases/update-category/update-category.use-case';
import { CreateCategoryDto } from '@/modules/categories/presentation/dto/create-category.dto';
import { DeleteCategoryWithMergeDto } from '@/modules/categories/presentation/dto/delete-category-with-merge.dto';
import { CategoryMetadataResponseDto } from '@/modules/categories/presentation/dto/category-metadata.response.dto';
import { ListCategoriesQueryDto } from '@/modules/categories/presentation/dto/list-categories.query.dto';
import { ListCategoriesResponseDto } from '@/modules/categories/presentation/dto/list-categories.response.dto';
import { UpdateCategoryDto } from '@/modules/categories/presentation/dto/update-category.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoryResponseDto } from '../dto/category.response.dto';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly createCategoryUseCase: CreateCategoryUseCase,
    private readonly listCategoriesUseCase: ListCategoriesUseCase,
    private readonly getCategoryUseCase: GetCategoryUseCase,
    private readonly updateCategoryUseCase: UpdateCategoryUseCase,
    private readonly archiveCategoryUseCase: ArchiveCategoryUseCase,
    private readonly unarchiveCategoryUseCase: UnarchiveCategoryUseCase,
    private readonly deleteCategoryUseCase: DeleteCategoryUseCase,
    private readonly deleteCategoryWithMergeUseCase: DeleteCategoryWithMergeUseCase,
    private readonly getCategoryMetadataUseCase: GetCategoryMetadataUseCase,
  ) {}

  @Post()
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Criar categoria',
    description:
      'Cria uma categoria gerenciável pelo usuário. Tipos técnicos como TRANSFER e ADJUSTMENT são reservados ao sistema.',
  })
  @ApiResponse({ status: 201, description: 'Categoria criada com sucesso', type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Body inválido ou tipo técnico enviado para criação manual' })
  @ApiConflictResponse({ description: 'Já existe uma categoria ativa com o mesmo nome canônico e tipo' })
  async create(@CurrentUser() user: User, @Body() body: CreateCategoryDto): Promise<CategoryResponseDto> {
    const category = await this.createCategoryUseCase.execute({
      userId: user.id,
      displayName: body.displayName,
      type: body.type,
      description: body.description,
      colorToken: body.colorToken,
      iconKey: body.iconKey,
      includeInReports: body.includeInReports,
      sortOrder: body.sortOrder,
    });

    return CategoryResponseDto.fromDomain(category);
  }

  @Get('metadata')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Obter catálogo visual de categorias',
    description:
      'Retorna os tokens oficiais de ícones e cores aceitos pelo backend para criação e edição de categorias.',
  })
  @ApiOkResponse({ description: 'Catálogo visual de categorias', type: CategoryMetadataResponseDto })
  getMetadata(): CategoryMetadataResponseDto {
    return CategoryMetadataResponseDto.fromUseCaseOutput(this.getCategoryMetadataUseCase.execute());
  }

  @Get()
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Listar categorias gerenciáveis',
    description:
      'Lista categorias do usuário para tela de gerenciamento. Categorias sistêmicas e técnicas não aparecem nesta rota.',
  })
  @ApiOkResponse({ description: 'Lista paginada de categorias', type: ListCategoriesResponseDto })
  @ApiBadRequestResponse({ description: 'Parâmetros de paginação, busca ou tipo inválidos' })
  async list(@CurrentUser() user: User, @Query() query: ListCategoriesQueryDto): Promise<ListCategoriesResponseDto> {
    const output = await this.listCategoriesUseCase.execute({
      userId: user.id,
      includeArchived: query.includeArchived,
      type: query.type,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });

    return ListCategoriesResponseDto.fromUseCaseOutput(output);
  }

  @Get(':id')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Buscar categoria por id',
    description:
      'Retorna uma categoria gerenciável do usuário. Categorias sistêmicas ou técnicas retornam 404 nesta rota.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria', format: 'uuid' })
  @ApiOkResponse({ description: 'Categoria encontrada', type: CategoryResponseDto })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada ou não gerenciável pelo usuário' })
  async getById(@CurrentUser() user: User, @Param('id') categoryId: string): Promise<CategoryResponseDto> {
    const category = await this.getCategoryUseCase.execute({
      userId: user.id,
      categoryId,
    });

    return CategoryResponseDto.fromDomain(category);
  }

  @Patch(':id')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Atualizar categoria',
    description: 'Atualiza campos editáveis de uma categoria ativa, não sistêmica e não técnica.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria', format: 'uuid' })
  @ApiOkResponse({ description: 'Categoria atualizada com sucesso', type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Body inválido' })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada' })
  @ApiConflictResponse({ description: 'Categoria não editável ou nome duplicado para o mesmo tipo' })
  async update(
    @CurrentUser() user: User,
    @Param('id') categoryId: string,
    @Body() body: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.updateCategoryUseCase.execute({
      userId: user.id,
      categoryId,
      patch: body,
    });

    return CategoryResponseDto.fromDomain(category);
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Arquivar categoria',
    description: 'Arquiva uma categoria gerenciável. Categorias sistêmicas ou técnicas não podem ser arquivadas.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Categoria arquivada com sucesso' })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada' })
  @ApiConflictResponse({ description: 'Categoria sistêmica ou técnica não pode ser arquivada' })
  async archive(@CurrentUser() user: User, @Param('id') categoryId: string): Promise<void> {
    await this.archiveCategoryUseCase.execute({
      userId: user.id,
      categoryId,
    });
  }

  @Patch(':id/unarchive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Desarquivar categoria',
    description:
      'Desarquiva uma categoria gerenciável. Falha se já existir categoria ativa com mesmo nome canônico e tipo.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Categoria desarquivada com sucesso' })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada' })
  @ApiConflictResponse({ description: 'Categoria não gerenciável ou nome duplicado ao reativar' })
  async unarchive(@CurrentUser() user: User, @Param('id') categoryId: string): Promise<void> {
    await this.unarchiveCategoryUseCase.execute({
      userId: user.id,
      categoryId,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Deletar categoria sem transações',
    description: 'Remove fisicamente uma categoria gerenciável apenas quando ela não possui transações vinculadas.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Categoria deletada com sucesso' })
  @ApiNotFoundResponse({ description: 'Categoria não encontrada' })
  @ApiConflictResponse({ description: 'Categoria não gerenciável ou possui transações vinculadas' })
  async delete(@CurrentUser() user: User, @Param('id') categoryId: string): Promise<void> {
    await this.deleteCategoryUseCase.execute({
      userId: user.id,
      categoryId,
    });
  }

  @Post(':id/delete-with-merge')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Mover transações para outra categoria e deletar a categoria atual',
    description:
      'Move todas as transações da categoria origem para uma categoria destino compatível e remove a origem em uma transação atômica.',
  })
  @ApiParam({ name: 'id', description: 'ID da categoria origem', format: 'uuid' })
  @ApiBody({ type: DeleteCategoryWithMergeDto })
  @ApiNoContentResponse({ description: 'Transações movidas e categoria deletada com sucesso' })
  @ApiBadRequestResponse({ description: 'Body inválido' })
  @ApiNotFoundResponse({ description: 'Categoria origem não encontrada' })
  @ApiConflictResponse({ description: 'Destino inválido, arquivado, incompatível ou igual à origem' })
  async deleteWithMerge(
    @CurrentUser() user: User,
    @Param('id') categoryId: string,
    @Body() body: DeleteCategoryWithMergeDto,
  ): Promise<void> {
    await this.deleteCategoryWithMergeUseCase.execute({
      userId: user.id,
      categoryId,
      targetCategoryId: body.targetCategoryId,
    });
  }
}
