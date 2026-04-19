import { UserStatus } from '@/common/models/enums/user-status.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JwtPayloadDto {
  @ApiProperty({
    description: 'Identificador único do token (JWT ID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  jti: string;

  @ApiProperty({
    description: 'ID do usuário (subject)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  sub: string;

  @ApiProperty({
    description: 'E-mail do usuário',
    example: 'joao.silva@email.com',
  })
  email: string;

  @ApiProperty({
    description: 'Status atual do usuário',
    enum: UserStatus,
    example: 'active',
  })
  status: UserStatus;

  @ApiPropertyOptional({
    description: 'Timestamp de expiração do token (Unix timestamp)',
    example: 1707400000,
  })
  exp?: number;

  @ApiPropertyOptional({
    description: 'Timestamp de criação do token (Unix timestamp)',
    example: 1707396400,
  })
  iat?: number;
}
