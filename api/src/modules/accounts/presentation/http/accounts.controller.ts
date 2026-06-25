import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { ArchiveAccountUseCase } from '@/modules/accounts/application/use-cases/archive-account/archive-account.use-case';
import { CreateAccountUseCase } from '@/modules/accounts/application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from '@/modules/accounts/application/use-cases/list-accounts/list-accounts.use-case';
import { SetDefaultAccountUseCase } from '@/modules/accounts/application/use-cases/set-default-account/set-default-account.use-case';
import { UnarchiveAccountUseCase } from '@/modules/accounts/application/use-cases/unarchive-account/unarchive-account.use-case';
import { UpdateAccountUseCase } from '@/modules/accounts/application/use-cases/update-account/update-account.use-case';
import { UpdateAccountDto } from '@/modules/accounts/presentation/dto/update-account.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AccountResponseDto } from '../dto/account.response.dto';
import { CreateAccountDto } from '../dto/create-account.dto';
import { ListAccountsQueryDto } from '../dto/list-accounts.query.dto';

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed.',
      details: {
        fields: [{ field: 'projectedUntil', messages: ['projectedUntil must be a valid YYYY-MM-DD date.'] }],
      },
    });
  }

  return date;
}

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly listAccountsUseCase: ListAccountsUseCase,
    private readonly archiveAccountUseCase: ArchiveAccountUseCase,
    private readonly setDefaultAccountUseCase: SetDefaultAccountUseCase,
    private readonly unarchiveAccountUseCase: UnarchiveAccountUseCase,
    private readonly updateAccountUseCase: UpdateAccountUseCase,
  ) {}

  @Post()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Criar conta' })
  @ApiResponse({ status: 201, description: 'Conta criada com sucesso', type: AccountResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Body inválido ou regra de domínio inválida',
    type: PlatformErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Conflito de regra de negócio', type: PlatformErrorResponseDto })
  async create(@CurrentUser() user: User, @Body() body: CreateAccountDto): Promise<AccountResponseDto> {
    const account = await this.createAccountUseCase.execute({
      userId: user.id,
      name: body.name,
      type: body.type,
      initialBalanceCents: body.initialBalanceCents,
      color: body.color,
      icon: body.icon,
      includeInTotal: body.includeInTotal,
      isDefault: body.isDefault,
    });

    return AccountResponseDto.fromDomain(account);
  }

  @Patch(':id')
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Atualizar conta' })
  @ApiResponse({ status: 200, description: 'Conta atualizada com sucesso', type: AccountResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Body inválido ou regra de domínio inválida',
    type: PlatformErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Conta não encontrada', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Conta arquivada ou patch vazio', type: PlatformErrorResponseDto })
  async update(
    @CurrentUser() user: User,
    @Param('id') accountId: string,
    @Body() body: UpdateAccountDto,
  ): Promise<AccountResponseDto> {
    const updatedAccount = await this.updateAccountUseCase.execute({
      userId: user.id,
      accountId,
      patch: body,
    });

    return AccountResponseDto.fromDomain(updatedAccount);
  }

  @Get()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Listar contas do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de contas', type: [AccountResponseDto] })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  async list(@CurrentUser() user: User, @Query() query: ListAccountsQueryDto): Promise<AccountResponseDto[]> {
    const accounts = await this.listAccountsUseCase.execute({
      userId: user.id,
      includeArchived: query.includeArchived,
      projectedUntil: query.projectedUntil ? parseDateOnly(query.projectedUntil) : undefined,
    });

    return accounts.map(item => AccountResponseDto.fromDomain(item.account, item.balance));
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Arquivar conta' })
  @ApiResponse({ status: 204, description: 'Conta arquivada com sucesso' })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Conta não encontrada', type: PlatformErrorResponseDto })
  @ApiResponse({
    status: 409,
    description: 'Conta default, agendada ou última ativa não pode ser arquivada',
    type: PlatformErrorResponseDto,
  })
  async archive(@CurrentUser() user: User, @Param('id') accountId: string): Promise<void> {
    await this.archiveAccountUseCase.execute({
      userId: user.id,
      accountId,
    });
  }

  @Patch(':id/unarchive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Desarquivar conta' })
  @ApiResponse({ status: 204, description: 'Conta desarquivada com sucesso' })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Conta não encontrada', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Conta não está arquivada', type: PlatformErrorResponseDto })
  async unarchive(@CurrentUser() user: User, @Param('id') accountId: string): Promise<void> {
    await this.unarchiveAccountUseCase.execute({
      userId: user.id,
      accountId,
    });

    return;
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Definir conta padrão' })
  @ApiResponse({ status: 204, description: 'Conta padrão atualizada com sucesso' })
  @ApiResponse({ status: 401, description: 'Sessão ausente ou inválida', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Conta não encontrada', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Conta arquivada ou já default', type: PlatformErrorResponseDto })
  async setDefault(@CurrentUser() user: User, @Param('id') accountId: string): Promise<void> {
    await this.setDefaultAccountUseCase.execute({
      userId: user.id,
      accountId,
    });
  }
}
