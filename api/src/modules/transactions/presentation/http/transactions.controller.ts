import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { ConfirmTransactionUseCase } from '@/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.use-case';
import { CreateTransactionUseCase } from '@/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case';
import { DeleteTransactionUseCase } from '@/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case';
import { GetTransactionUseCase } from '@/modules/transactions/application/use-cases/get-transaction/get-transaction.use-case';
import { ListTransactionsUseCase } from '@/modules/transactions/application/use-cases/list-transactions/list-transactions.use-case';
import { UpdateTransactionPatch } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.dto';
import { UpdateTransactionUseCase } from '@/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case';
import { ConfirmTransactionDto } from '@/modules/transactions/presentation/dto/confirm-transaction.dto';
import { CreateTransactionDto } from '@/modules/transactions/presentation/dto/create-transaction.dto';
import { ListTransactionsQueryDto } from '@/modules/transactions/presentation/dto/list-transactions.query.dto';
import { ListTransactionsResponseDto } from '@/modules/transactions/presentation/dto/list-transactions.response.dto';
import { TransactionResponseDto } from '@/modules/transactions/presentation/dto/transaction.response.dto';
import { UpdateTransactionDto } from '@/modules/transactions/presentation/dto/update-transaction.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: {
        fields: [{ field: 'date', messages: ['date must be a valid YYYY-MM-DD date.'] }],
      },
    });
  }

  return date;
}

function buildPatch(body: UpdateTransactionDto | undefined): UpdateTransactionPatch {
  return {
    accountId: body?.accountId,
    destinationAccountId: body?.destinationAccountId,
    categoryId: body?.categoryId,
    type: body?.type,
    amountCents: body?.amountCents,
    date: body?.date ? parseDateOnly(body.date) : undefined,
    description: body?.description,
    direction: body?.direction,
  };
}

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    private readonly listTransactionsUseCase: ListTransactionsUseCase,
    private readonly getTransactionUseCase: GetTransactionUseCase,
    private readonly updateTransactionUseCase: UpdateTransactionUseCase,
    private readonly confirmTransactionUseCase: ConfirmTransactionUseCase,
    private readonly deleteTransactionUseCase: DeleteTransactionUseCase,
  ) {}

  @Post()
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Criar transaction',
    description:
      'Cria um lançamento financeiro do usuário autenticado. O valor deve ser enviado em centavos como amountCents.',
  })
  @ApiResponse({ status: 201, description: 'Transaction criada com sucesso', type: TransactionResponseDto })
  @ApiBadRequestResponse({
    description: 'Body inválido, combinação de campos inválida ou category incompatível com o type',
    type: PlatformErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Account/category indisponível ou operação não permitida',
    type: PlatformErrorResponseDto,
  })
  async create(@CurrentUser() user: User, @Body() body: CreateTransactionDto): Promise<TransactionResponseDto> {
    const transaction = await this.createTransactionUseCase.execute({
      userId: user.id,
      accountId: body.accountId,
      destinationAccountId: body.destinationAccountId,
      categoryId: body.categoryId,
      type: body.type,
      status: body.status,
      amountCents: body.amountCents,
      date: parseDateOnly(body.date),
      description: body.description,
      direction: body.direction,
    });

    return TransactionResponseDto.fromDomain(transaction);
  }

  @Get()
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Listar transactions',
    description: 'Lista transactions não deletadas do usuário autenticado com paginação e filtros básicos.',
  })
  @ApiOkResponse({ description: 'Lista paginada de transactions', type: ListTransactionsResponseDto })
  @ApiBadRequestResponse({ description: 'Query inválida', type: PlatformErrorResponseDto })
  async list(
    @CurrentUser() user: User,
    @Query() query: ListTransactionsQueryDto,
  ): Promise<ListTransactionsResponseDto> {
    const output = await this.listTransactionsUseCase.execute({
      userId: user.id,
      status: query.status,
      type: query.type,
      accountId: query.accountId,
      categoryId: query.categoryId,
      dateFrom: query.dateFrom ? parseDateOnly(query.dateFrom) : undefined,
      dateTo: query.dateTo ? parseDateOnly(query.dateTo) : undefined,
      page: query.page,
      limit: query.limit,
    });

    return ListTransactionsResponseDto.fromUseCaseOutput(output);
  }

  @Get(':id')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Buscar transaction por id' })
  @ApiParam({ name: 'id', description: 'ID da transaction', format: 'uuid' })
  @ApiOkResponse({ description: 'Transaction encontrada', type: TransactionResponseDto })
  @ApiNotFoundResponse({ description: 'Transaction não encontrada', type: PlatformErrorResponseDto })
  async getById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.getTransactionUseCase.execute({
      userId: user.id,
      transactionId,
    });

    return TransactionResponseDto.fromDomain(transaction);
  }

  @Patch(':id')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Atualizar transaction',
    description:
      'Atualiza dados editáveis da transaction. Status não é alterado por esta rota; use /confirm para efetivar pendências.',
  })
  @ApiParam({ name: 'id', description: 'ID da transaction', format: 'uuid' })
  @ApiBody({ type: UpdateTransactionDto })
  @ApiOkResponse({ description: 'Transaction atualizada com sucesso', type: TransactionResponseDto })
  @ApiBadRequestResponse({
    description: 'Body inválido, combinação de campos inválida ou category incompatível com o type',
    type: PlatformErrorResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction não encontrada', type: PlatformErrorResponseDto })
  @ApiConflictResponse({ description: 'Operação não permitida no estado atual', type: PlatformErrorResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: UpdateTransactionDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.updateTransactionUseCase.execute({
      userId: user.id,
      transactionId,
      patch: buildPatch(body),
    });

    return TransactionResponseDto.fromDomain(transaction);
  }

  @Patch(':id/confirm')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Confirmar transaction pendente',
    description:
      'Transforma uma transaction PENDING em EFFECTIVE. O body pode ajustar dados finais antes da confirmação.',
  })
  @ApiParam({ name: 'id', description: 'ID da transaction', format: 'uuid' })
  @ApiBody({ type: ConfirmTransactionDto })
  @ApiOkResponse({ description: 'Transaction confirmada com sucesso', type: TransactionResponseDto })
  @ApiBadRequestResponse({
    description: 'Body inválido, combinação de campos inválida ou category incompatível com o type',
    type: PlatformErrorResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Transaction não encontrada', type: PlatformErrorResponseDto })
  @ApiConflictResponse({
    description: 'Transaction já efetivada ou operação não permitida',
    type: PlatformErrorResponseDto,
  })
  async confirm(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) transactionId: string,
    @Body() body: ConfirmTransactionDto,
  ): Promise<TransactionResponseDto> {
    const transaction = await this.confirmTransactionUseCase.execute({
      userId: user.id,
      transactionId,
      patch: buildPatch(body),
    });

    return TransactionResponseDto.fromDomain(transaction);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Deletar transaction',
    description: 'Remove uma transaction do histórico ativo. TRANSFER não pode ser deletada na V0.',
  })
  @ApiParam({ name: 'id', description: 'ID da transaction', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Transaction deletada com sucesso' })
  @ApiNotFoundResponse({ description: 'Transaction não encontrada', type: PlatformErrorResponseDto })
  @ApiConflictResponse({ description: 'Transfer não pode ser deletada na V0', type: PlatformErrorResponseDto })
  async delete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) transactionId: string): Promise<void> {
    await this.deleteTransactionUseCase.execute({
      userId: user.id,
      transactionId,
    });
  }
}
