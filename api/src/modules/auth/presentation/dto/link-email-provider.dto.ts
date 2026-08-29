import { Allow, IsNotEmpty, IsString, Length } from 'class-validator';
import { IsPasswordWithinUtf8ByteLimit } from '@/common/decorators/is-password-within-utf8-byte-limit.decorator';
import {
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MAX_UTF8_BYTES,
  USER_PASSWORD_MIN_LENGTH,
} from '@/common/models/constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LinkEmailProviderDto {
  @ApiPropertyOptional({
    description: 'Campo legado depreciado. O valor é aceito temporariamente e ignorado.',
    type: String,
    example: 'joao.silva@email.com',
    deprecated: true,
  })
  @Allow()
  email?: unknown;

  @ApiProperty({
    description: `Senha do usuário, limitada simultaneamente a ${USER_PASSWORD_MAX_LENGTH} caracteres e ${USER_PASSWORD_MAX_UTF8_BYTES} bytes em UTF-8`,
    example: 'senhaSegura123',
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password should not be empty.' })
  @IsPasswordWithinUtf8ByteLimit()
  @Length(USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_MAX_LENGTH, {
    message: 'The password must be between 6 and 50 characters long.',
  })
  password: string;
}
