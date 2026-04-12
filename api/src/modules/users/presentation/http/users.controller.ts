import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { User } from '../../domain/entities/user.entity';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthProviderType } from '../../../../common/models/enums';

@Controller('users')
export class UsersController {
  constructor() {}

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
}
