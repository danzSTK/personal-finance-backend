import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { ImportFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/import-fiscal-note/import-fiscal-note.use-case';
import { PreviewFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/preview-fiscal-note/preview-fiscal-note.use-case';
import {
  FISCAL_NOTES_HTTP_THROTTLE_LIMIT,
  FISCAL_NOTES_HTTP_THROTTLE_TTL_MS,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNotePreviewResponseDto } from '@/modules/fiscal-notes/presentation/dto/fiscal-note-preview.response.dto';
import { ImportFiscalNoteDto } from '@/modules/fiscal-notes/presentation/dto/import-fiscal-note.dto';
import { ImportFiscalNoteResponseDto } from '@/modules/fiscal-notes/presentation/dto/import-fiscal-note.response.dto';
import { PreviewFiscalNoteDto } from '@/modules/fiscal-notes/presentation/dto/preview-fiscal-note.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('fiscal-notes')
@ApiCookieAuth('accessToken')
@Controller('fiscal-notes')
export class FiscalNotesController {
  constructor(
    private readonly previewFiscalNoteUseCase: PreviewFiscalNoteUseCase,
    private readonly importFiscalNoteUseCase: ImportFiscalNoteUseCase,
  ) {}

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
      userId: user.id,
      input: body.input,
      accountId: body.accountId,
      categoryId: body.categoryId,
      amountCents: body.amountCents,
      date: body.date,
      description: body.description,
      status: body.status,
    });

    return ImportFiscalNoteResponseDto.fromOutput(output);
  }
}
