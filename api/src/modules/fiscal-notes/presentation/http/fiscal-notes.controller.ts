import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { GetFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-fiscal-note/get-fiscal-note.use-case';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import { ListFiscalNotesUseCase } from '@/modules/fiscal-notes/application/use-cases/list-fiscal-notes/list-fiscal-notes.use-case';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import {
  FISCAL_NOTES_HTTP_THROTTLE_LIMIT,
  FISCAL_NOTES_HTTP_THROTTLE_TTL_MS,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNotePreviewResponseDto } from '@/modules/fiscal-notes/presentation/dto/fiscal-note-preview.response.dto';
import { FiscalNoteResponseDto } from '@/modules/fiscal-notes/presentation/dto/fiscal-note.response.dto';
import { ImportFiscalNoteDto } from '@/modules/fiscal-notes/presentation/dto/import-fiscal-note.dto';
import { ImportFiscalNoteResponseDto } from '@/modules/fiscal-notes/presentation/dto/import-fiscal-note.response.dto';
import { ListFiscalNotesQueryDto } from '@/modules/fiscal-notes/presentation/dto/list-fiscal-notes.query.dto';
import { ListFiscalNotesResponseDto } from '@/modules/fiscal-notes/presentation/dto/list-fiscal-notes.response.dto';
import { PreviewFiscalNoteDto } from '@/modules/fiscal-notes/presentation/dto/preview-fiscal-note.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('fiscal-notes')
@ApiCookieAuth('accessToken')
@Controller('fiscal-notes')
export class FiscalNotesController {
  constructor(
    private readonly listFiscalNotesUseCase: ListFiscalNotesUseCase,
    private readonly getFiscalNoteUseCase: GetFiscalNoteUseCase,
    private readonly previewFiscalNoteUseCase: PreviewFiscalNoteUseCase,
    private readonly importFiscalNoteUseCase: ImportFiscalNoteUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar notas fiscais ativas do usuário com filtros e paginação',
    description:
      'Retorna listagem paginada leve das notas fiscais ativas do usuário autenticado com filtros combináveis, ordenação allowlisted e sumário financeiro agregado do recorte.',
  })
  @ApiOkResponse({ type: ListFiscalNotesResponseDto })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  async list(@CurrentUser() user: User, @Query() query: ListFiscalNotesQueryDto): Promise<ListFiscalNotesResponseDto> {
    const output = await this.listFiscalNotesUseCase.execute({
      userId: user.id,
      issuedFrom: query.issuedFrom,
      issuedTo: query.issuedTo,
      issuerCnpj: query.issuerCnpj,
      sourceUf: query.sourceUf,
      minAmountCents: query.minAmountCents,
      maxAmountCents: query.maxAmountCents,
      search: query.search,
      page: query.page,
      limit: query.limit,
      sort: query.sort,
    });

    return ListFiscalNotesResponseDto.fromUseCaseOutput(output);
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: FISCAL_NOTES_HTTP_THROTTLE_LIMIT, ttl: FISCAL_NOTES_HTTP_THROTTLE_TTL_MS } })
  @ApiOperation({
    summary: 'Pré-visualizar NFC-e via QR Code ou chave de acesso',
    description:
      'Valida localmente a entrada, consulta cache Redis ou SEFAZ-CE em cache miss e retorna os dados fiscais sanitizados com sugestões para criação da despesa.',
  })
  @ApiOkResponse({ type: FiscalNotePreviewResponseDto })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 422, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 429, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 502, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 503, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 504, type: PlatformErrorResponseDto })
  async preview(@CurrentUser() user: User, @Body() body: PreviewFiscalNoteDto): Promise<FiscalNotePreviewResponseDto> {
    const output = await this.previewFiscalNoteUseCase.execute({
      userId: user.id,
      input: body.input,
    });

    return FiscalNotePreviewResponseDto.fromOutput(output);
  }

  @Post('import')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: FISCAL_NOTES_HTTP_THROTTLE_LIMIT, ttl: FISCAL_NOTES_HTTP_THROTTLE_TTL_MS } })
  @ApiOperation({
    summary: 'Importar NFC-e criando nova despesa atomicamente',
    description:
      'Consulta cache/SEFAZ antes da transação e cria atomicamente a Transaction (EXPENSE), FiscalNote, itens e pagamentos.',
  })
  @ApiResponse({ status: 201, type: ImportFiscalNoteResponseDto })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 422, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 429, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 502, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 503, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 504, type: PlatformErrorResponseDto })
  async importFiscalNote(
    @CurrentUser() user: User,
    @Body() body: ImportFiscalNoteDto,
  ): Promise<ImportFiscalNoteResponseDto> {
    const output = await this.importFiscalNoteUseCase.execute({
      ...body,
      userId: user.id,
    });

    return ImportFiscalNoteResponseDto.fromOutput(output);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar nota fiscal ativa por ID',
    description:
      'Retorna os detalhes completos (cabeçalho, itens e pagamentos ordenados) de uma nota fiscal ativa pertencente ao usuário autenticado.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da nota fiscal' })
  @ApiOkResponse({ type: FiscalNoteResponseDto })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  async getById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) fiscalNoteId: string,
  ): Promise<FiscalNoteResponseDto> {
    const fiscalNote = await this.getFiscalNoteUseCase.execute({
      userId: user.id,
      fiscalNoteId,
    });

    return FiscalNoteResponseDto.fromDomain(fiscalNote);
  }
}
