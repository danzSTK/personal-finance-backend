import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/domain/entities/user.entity';
import { CreateAccountUseCase } from '@/modules/accounts/application/use-cases/create-account/create-account.use-case';
import { ListAccountsUseCase } from '@/modules/accounts/application/use-cases/list-accounts/list-accounts.use-case';
import { ArchiveAccountUseCase } from '@/modules/accounts/application/use-cases/archive-account/archive-account.use-case';
import { SetDefaultAccountUseCase } from '@/modules/accounts/application/use-cases/set-default-account/set-default-account.use-case';
import { CreateAccountDto } from '../dto/create-account.dto';
import { ListAccountsQueryDto } from '../dto/list-accounts.query.dto';
import { AccountResponseDto } from '../dto/account.response.dto';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly createAccountUseCase: CreateAccountUseCase,
    private readonly listAccountsUseCase: ListAccountsUseCase,
    private readonly archiveAccountUseCase: ArchiveAccountUseCase,
    private readonly setDefaultAccountUseCase: SetDefaultAccountUseCase,
  ) {}

  @Post()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Criar conta' })
  @ApiResponse({ status: 201, description: 'Conta criada com sucesso', type: AccountResponseDto })
  async create(@CurrentUser() user: User, @Body() body: CreateAccountDto): Promise<AccountResponseDto> {
    const account = await this.createAccountUseCase.execute({
      userId: user.id,
      name: body.name,
      type: body.type,
      initialBalance: body.initialBalance ?? 0,
      color: body.color,
      icon: body.icon,
      includeInTotal: body.includeInTotal,
      isDefault: body.isDefault,
    });

    return AccountResponseDto.fromDomain(account);
  }

  @Get()
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Listar contas do usuário autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de contas', type: [AccountResponseDto] })
  async list(@CurrentUser() user: User, @Query() query: ListAccountsQueryDto): Promise<AccountResponseDto[]> {
    const accounts = await this.listAccountsUseCase.execute({
      userId: user.id,
      includeArchived: query.includeArchived,
    });

    return accounts.map(account => AccountResponseDto.fromDomain(account));
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Arquivar conta' })
  @ApiResponse({ status: 204, description: 'Conta arquivada com sucesso' })
  async archive(@CurrentUser() user: User, @Param('id') accountId: string): Promise<void> {
    await this.archiveAccountUseCase.execute({
      userId: user.id,
      accountId,
    });
  }

  @Patch(':id/default')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Definir conta padrão' })
  @ApiResponse({ status: 204, description: 'Conta padrão atualizada com sucesso' })
  async setDefault(@CurrentUser() user: User, @Param('id') accountId: string): Promise<void> {
    await this.setDefaultAccountUseCase.execute({
      userId: user.id,
      accountId,
    });
  }
}
