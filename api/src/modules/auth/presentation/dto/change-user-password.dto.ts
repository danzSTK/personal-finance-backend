import { IsPasswordWithinUtf8ByteLimit } from '@/common/decorators/is-password-within-utf8-byte-limit.decorator';
import {
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MAX_UTF8_BYTES,
  USER_PASSWORD_MIN_LENGTH,
} from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ChangeUserPasswordDto {
  @ApiProperty({
    description: `Senha atual da conta local, limitada simultaneamente a ${USER_PASSWORD_MAX_LENGTH} caracteres e ${USER_PASSWORD_MAX_UTF8_BYTES} bytes em UTF-8`,
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString()
  @IsPasswordWithinUtf8ByteLimit()
  @Length(USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @ApiProperty({
    description: `Nova senha da conta local, limitada simultaneamente a ${USER_PASSWORD_MAX_LENGTH} caracteres e ${USER_PASSWORD_MAX_UTF8_BYTES} bytes em UTF-8`,
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString()
  @IsPasswordWithinUtf8ByteLimit()
  @Length(USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
