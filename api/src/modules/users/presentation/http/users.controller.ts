import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { CreateUserDto } from '../dto/create-user.dto';
import { CreateUserUseCase } from '../../application/use-cases/create-user/create-user.use-case';
import { FindUserByIdUseCase } from '../../application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { User } from '../../domain/entities/user.entity';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthProviderType } from '../../../../common/models/enums';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly findByUserIdUseCase: FindUserByIdUseCase,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Obter dados do usuário autenticado',
    description: 'Retorna os dados do usuário logado a partir do token JWT.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dados do usuário retornados com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        lastName: { type: 'string', example: 'Silva', nullable: true },
        firstName: { type: 'string', example: 'João', nullable: true },
        userName: { type: 'string', example: 'john_doe', nullable: true },
        email: { type: 'string', example: 'joao.silva@email.com' },
        status: { type: 'string', example: 'active' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
        providers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              provider: { type: 'string', example: AuthProviderType.GOOGLE, enum: Object.values(AuthProviderType) },
              linkedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado' })
  getMe(@CurrentUser() user: User) {
    return {
      id: user.id,
      lastName: user.lastName,
      firstName: user.firstName,
      userName: user.userName?.value ?? null,
      email: user.email.value,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      providers: user.authProviders.map(provider => ({
        provider: provider.provider,
        linkedAt: provider.createdAt,
      })),
    };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.createUserUseCase.execute(createUserDto);

    return {
      id: user.id,
      email: user.email.value,
      userName: user.userName?.value ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Get()
  findAll() {
    return 'Next update';
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.findByUserIdUseCase.execute(id);

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email.value,
      userName: user.userName?.value ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
