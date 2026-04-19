import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { User } from '@/modules/users/domain/entities/user.entity';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { UserProfileResponseDto } from '@/common/dto/user-profile.response.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor() {}

  @Get('me')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Obter dados do usuário autenticado',
    description: 'Retorna os dados do usuário logado a partir do cookie HttpOnly accessToken.',
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
        status: { type: 'string', example: UserStatus.ACTIVE, enum: Object.values(UserStatus) },
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
  getMe(@CurrentUser() user: User): UserProfileResponseDto {
    return UserProfileResponseDto.fromEntity(user);
  }
}
