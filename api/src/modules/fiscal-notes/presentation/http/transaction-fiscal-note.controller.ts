import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { GetTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/get-transaction-fiscal-note/get-transaction-fiscal-note.use-case';
import { LinkFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/link-fiscal-note/link-fiscal-note.use-case';
import { UnlinkTransactionFiscalNoteUseCase } from '@/modules/fiscal-notes/application/use-cases/unlink-transaction-fiscal-note/unlink-transaction-fiscal-note.use-case';
import {
  FISCAL_NOTES_HTTP_THROTTLE_LIMIT,
  FISCAL_NOTES_HTTP_THROTTLE_TTL_MS,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteResponseDto } from '@/modules/fiscal-notes/presentation/dto/fiscal-note.response.dto';
import { LinkFiscalNoteDto } from '@/modules/fiscal-notes/presentation/dto/link-fiscal-note.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

@ApiTags('fiscal-notes')
@ApiCookieAuth('accessToken')
@Controller('transactions/:id/fiscal-note')
export class TransactionFiscalNoteController {
  constructor(
    private readonly linkFiscalNoteUseCase: LinkFiscalNoteUseCase,
    private readonly getTransactionFiscalNoteUseCase: GetTransactionFiscalNoteUseCase,
    private readonly unlinkTransactionFiscalNoteUseCase: UnlinkTransactionFiscalNoteUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: FISCAL_NOTES_HTTP_THROTTLE_LIMIT, ttl: FISCAL_NOTES_HTTP_THROTTLE_TTL_MS } })
  @ApiOperation({
    summary: 'Vincular NFC-e a uma despesa existente',
    description:
      'Vincula uma nota fiscal a uma Transaction (EXPENSE) existente sem alterar valor, data, descrição ou demais campos da transação.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiResponse({ status: 201, type: FiscalNoteResponseDto })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 422, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 429, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 502, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 503, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 504, type: PlatformErrorResponseDto })
  async link(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: LinkFiscalNoteDto,
  ): Promise<FiscalNoteResponseDto> {
    const fiscalNote = await this.linkFiscalNoteUseCase.execute({
      userId: user.id,
      transactionId,
      input: body.input,
    });

    return FiscalNoteResponseDto.fromDomain(fiscalNote);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Consultar nota fiscal ativa vinculada à transação' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiOkResponse({ type: FiscalNoteResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  async getByTransaction(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<FiscalNoteResponseDto> {
    const fiscalNote = await this.getTransactionFiscalNoteUseCase.execute({
      userId: user.id,
      transactionId,
    });

    return FiscalNoteResponseDto.fromDomain(fiscalNote);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Desvincular nota fiscal da transação',
    description:
      'Realiza soft delete apenas da nota fiscal vinculada, mantendo a transação intacta e liberando a chave para reimportação.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'ID da transação' })
  @ApiNoContentResponse({ description: 'Nota fiscal desvinculada com sucesso' })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, type: PlatformErrorResponseDto })
  async unlink(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) transactionId: string): Promise<void> {
    await this.unlinkTransactionFiscalNoteUseCase.execute({
      userId: user.id,
      transactionId,
    });
  }
}
