import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsPublic } from '@/common/decorators/is-public.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { UserProfileResponseDto } from '@/common/dto/user-profile.response.dto';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { CheckUsernameAvailabilityUseCaseOutput } from '@/modules/users/application/use-cases/check-username-availability/check-username.dto';
import { CheckUsernameAvailabilityUseCase } from '@/modules/users/application/use-cases/check-username-availability/check-username.use-case';
import { UpdateUserProfileUseCase } from '@/modules/users/application/use-cases/update-user-profile/update-user-profile.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { UpdateUserProfileDto } from '@/modules/users/presentation/dto/update-user-profile.dto';
import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly checkUsernameAvailabilityUseCase: CheckUsernameAvailabilityUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
  ) {}

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
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado', type: PlatformErrorResponseDto })
  getMe(@CurrentUser() user: User): UserProfileResponseDto {
    return UserProfileResponseDto.fromEntity(user);
  }

  @Patch('me')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Atualizar perfil do usuário autenticado',
    description:
      'Atualiza firstName e/ou lastName. Campos omitidos permanecem inalterados e null remove o valor atual.',
  })
  @ApiBody({ type: UpdateUserProfileDto })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com sucesso', type: UserProfileResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Body inválido, patch vazio (USER_UPDATE_INPUT_VOID) ou nome inválido (INVALID_USER)',
    type: PlatformErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado', type: PlatformErrorResponseDto })
  async updateUserProfile(
    @CurrentUser() user: User,
    @Body() data: UpdateUserProfileDto,
  ): Promise<UserProfileResponseDto> {
    const updateProfileResponse = await this.updateUserProfileUseCase.execute({
      user,
      firstName: data.firstName,
      lastName: data.lastName,
    });

    return UserProfileResponseDto.fromEntity(updateProfileResponse);
  }

  @IsPublic()
  @Get('usernames/:username/availability')
  @ApiOperation({
    summary: 'Verificar disponibilidade de username',
    description: 'Valida o formato do username pelo domínio e informa se ele já está em uso.',
  })
  @ApiParam({ name: 'username', example: 'john_doe' })
  @ApiResponse({
    status: 200,
    description: 'Resultado da disponibilidade do username',
    schema: {
      type: 'object',
      properties: {
        username: { type: 'string', example: 'john_doe' },
        available: { type: 'boolean', example: true },
        reason: {
          type: 'string',
          example: 'AVAILABLE',
          enum: ['AVAILABLE', 'INVALID_FORMAT', 'ALREADY_EXISTS', 'INVALID'],
        },
      },
    },
  })
  checkUsernameAvailability(@Param('username') username: string): Promise<CheckUsernameAvailabilityUseCaseOutput> {
    return this.checkUsernameAvailabilityUseCase.execute({ username });
  }
}
