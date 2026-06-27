import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { IsPublic } from '@/common/decorators/is-public.decorator';
import { PlatformErrorResponseDto } from '@/common/dto/platform-error.response.dto';
import { UserProfileResponseDto } from '@/common/dto/user-profile.response.dto';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { CheckUsernameAvailabilityUseCaseOutput } from '@/modules/users/application/use-cases/check-username-availability/check-username.dto';
import { CheckUsernameAvailabilityUseCase } from '@/modules/users/application/use-cases/check-username-availability/check-username.use-case';
import { GetUserProfileUseCase } from '@/modules/users/application/use-cases/get-user-profile/get-user-profile.use-case';
import { RemoveUserAvatarUseCase } from '@/modules/users/application/use-cases/remove-user-avatar/remove-user-avatar.use-case';
import { UpdateUserProfileUseCase } from '@/modules/users/application/use-cases/update-user-profile/update-user-profile.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { UpdateUserProfileDto } from '@/modules/users/presentation/dto/update-user-profile.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  CHANGER_USERNAME_THROTTLE_BLOCK_TIME_MS,
  CHANGER_USERNAME_THROTTLE_LIMIT,
  CHANGER_USERNAME_THROTTLE_TIME_MS,
  USER_AVATAR_MAX_INPUT_BYTES,
  USER_CHANGER_AVATAR_THROTTLE_BLOCK_TIME_MS,
  USER_CHANGER_AVATAR_THROTTLE_LIMIT,
  USER_CHANGER_AVATAR_THROTTLE_TIME_MS,
} from '@/common/models/constants';
import { UpdateUserAvatarUseCase } from '@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.use-case';
import { UpdateUsernameUseCase } from '@/modules/users/application/use-cases/update-username/update-username.use-case';
import { UpdateUserAvatarResponseDto } from '@/modules/users/presentation/dto/update-user-avatar.response.dto';
import { UpdateUsernameDto } from '@/modules/users/presentation/dto/update-username.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly checkUsernameAvailabilityUseCase: CheckUsernameAvailabilityUseCase,
    private readonly getUserProfileUseCase: GetUserProfileUseCase,
    private readonly updateUserProfileUseCase: UpdateUserProfileUseCase,
    private readonly updateUserAvatarUseCase: UpdateUserAvatarUseCase,
    private readonly removeUserAvatarUseCase: RemoveUserAvatarUseCase,
    private readonly updateUsernameUseCase: UpdateUsernameUseCase,
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
        avatarUrl: {
          type: 'string',
          example: 'https://assets.example.com/users/123e4567-e89b-12d3-a456-426614174000/avatars/avatar-id.webp',
          nullable: true,
        },
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
  async getMe(@CurrentUser() user: User): Promise<UserProfileResponseDto> {
    return this.toUserProfileResponse(user);
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

    return this.toUserProfileResponse(updateProfileResponse);
  }

  @Throttle({
    default: {
      ttl: CHANGER_USERNAME_THROTTLE_TIME_MS,
      limit: CHANGER_USERNAME_THROTTLE_LIMIT,
      blockDuration: CHANGER_USERNAME_THROTTLE_BLOCK_TIME_MS,
    },
  })
  @Put('me/username')
  @ApiCookieAuth('accessToken')
  @ApiOperation({
    summary: 'Alterar username do usuário autenticado',
    description: 'Normaliza o username para lowercase, valida o formato e rejeita valores já usados por outro usuário.',
  })
  @ApiBody({ type: UpdateUsernameDto })
  @ApiResponse({ status: 200, description: 'Username atualizado com sucesso', type: UserProfileResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Payload inválido ou username viola regra de formato (INVALID_USERNAME_FORMAT)',
    type: PlatformErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Token inválido ou expirado', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 404, description: 'Usuário autenticado não existe mais', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 409, description: 'Username já está registrado', type: PlatformErrorResponseDto })
  @ApiResponse({ status: 429, description: 'Limite de tentativas excedido', type: PlatformErrorResponseDto })
  async changeUsername(@CurrentUser() user: User, @Body() data: UpdateUsernameDto): Promise<UserProfileResponseDto> {
    const result = await this.updateUsernameUseCase.execute({ userId: user.id, newUsername: data.username });

    return this.toUserProfileResponse(result);
  }

  @Throttle({
    default: {
      ttl: USER_CHANGER_AVATAR_THROTTLE_TIME_MS,
      limit: USER_CHANGER_AVATAR_THROTTLE_LIMIT,
      blockDuration: USER_CHANGER_AVATAR_THROTTLE_BLOCK_TIME_MS,
    },
  })
  @Put('me/avatar')
  @ApiCookieAuth('accessToken')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Atualizar avatar do usuário autenticado' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: UpdateUserAvatarResponseDto })
  @ApiResponse({ status: 400, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 413, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 415, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 422, type: PlatformErrorResponseDto })
  @ApiResponse({ status: 503, type: PlatformErrorResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: USER_AVATAR_MAX_INPUT_BYTES,
      },
    }),
  )
  async updateAvatar(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: USER_AVATAR_MAX_INPUT_BYTES })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ): Promise<UpdateUserAvatarResponseDto> {
    const output = await this.updateUserAvatarUseCase.execute({
      userId: user.id,
      bytes: file.buffer,
    });

    return UpdateUserAvatarResponseDto.fromOutput(output);
  }

  @Throttle({
    default: {
      ttl: USER_CHANGER_AVATAR_THROTTLE_TIME_MS,
      limit: USER_CHANGER_AVATAR_THROTTLE_LIMIT,
      blockDuration: USER_CHANGER_AVATAR_THROTTLE_BLOCK_TIME_MS,
    },
  })
  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth('accessToken')
  @ApiOperation({ summary: 'Remover avatar do usuário autenticado' })
  @ApiResponse({ status: 204, description: 'Avatar removido ou usuário já estava sem avatar' })
  @ApiResponse({ status: 401, type: PlatformErrorResponseDto })
  async removeAvatar(@CurrentUser() user: User): Promise<void> {
    await this.removeUserAvatarUseCase.execute({ userId: user.id });
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

  private async toUserProfileResponse(user: User): Promise<UserProfileResponseDto> {
    const profile = await this.getUserProfileUseCase.execute({ user });

    return UserProfileResponseDto.fromEntity(profile.user, { avatarUrl: profile.avatarUrl });
  }
}
