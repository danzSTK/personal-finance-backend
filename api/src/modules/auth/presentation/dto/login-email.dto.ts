import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { IsPasswordWithinUtf8ByteLimit } from '@/common/decorators/is-password-within-utf8-byte-limit.decorator';
import { TrimAndLowerCase } from '@/common/decorators/normalize-string.decorator';
import {
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MAX_UTF8_BYTES,
  USER_PASSWORD_MIN_LENGTH,
} from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export class LoginEmailDto {
  @ApiProperty({
    description: 'Endereço de e-mail cadastrado',
    example: 'joao.silva@email.com',
    format: 'email',
  })
  @TrimAndLowerCase()
  @IsString({ message: 'Email must be a string' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: `Senha do usuário, limitada simultaneamente a ${USER_PASSWORD_MAX_LENGTH} caracteres e ${USER_PASSWORD_MAX_UTF8_BYTES} bytes em UTF-8`,
    example: 'senhaSegura123',
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @IsPasswordWithinUtf8ByteLimit()
  password: string;
}
