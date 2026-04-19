import { ApiProperty } from '@nestjs/swagger';
import { AuthProviderType, UserStatus } from '../models/enums';
import { User } from '@/modules/users/domain/entities/user.entity';

export class UserProfileResponseDto {
  @ApiProperty({
    description: 'ID do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Sobrenome do usuário',
    example: 'Silva',
    nullable: true,
  })
  lastName!: string | null;

  @ApiProperty({
    description: 'Primeiro nome do usuário',
    example: 'João',
    nullable: true,
  })
  firstName!: string | null;

  @ApiProperty({
    description: 'Nome de usuário (username)',
    example: 'john_doe',
    nullable: true,
  })
  userName!: string | null;

  @ApiProperty({
    description: 'Email do usuário',
    example: 'joao.silva@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Status do usuário',
    enum: Object.values(UserStatus),
    example: 'ACTIVE',
  })
  status!: UserStatus;

  @ApiProperty({
    description: 'Data de criação do usuário',
    example: '2024-01-01T12:00:00Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Data da última atualização do usuário',
    example: '2024-01-10T15:30:00Z',
  })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Provedores de autenticação vinculados ao usuário',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        provider: {
          type: 'string',
          example: 'GOOGLE',
          enum: Object.values(AuthProviderType),
        },
        linkedAt: {
          type: 'string',
          format: 'date-time',
          example: '2024-01-05T10:20:00Z',
        },
      },
    },
  })
  providers!: { provider: AuthProviderType; linkedAt: Date }[];

  static fromEntity(user: User): UserProfileResponseDto {
    const dto = new UserProfileResponseDto();

    dto.id = user.id;
    dto.lastName = user.lastName;
    dto.firstName = user.firstName;
    dto.userName = user.userName?.value ?? null;
    dto.email = user.email.value;
    dto.status = user.status;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    dto.providers = user.authProviders.map(provider => ({
      provider: provider.provider,
      linkedAt: provider.createdAt,
    }));

    return dto;
  }
}
