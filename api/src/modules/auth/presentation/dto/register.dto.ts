import { TrimAndLowerCase } from '@/common/decorators/normalize-string.decorator';
import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_FIRST_NAME_MIN_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_LAST_NAME_MIN_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_NAME_MIN_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
} from '@/common/models/constants';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Nome de usuário único para identificação',
    example: 'john_doe',
    minLength: USER_NAME_MIN_LENGTH,
    maxLength: USER_NAME_MAX_LENGTH,
  })
  @TrimAndLowerCase()
  @IsString()
  @IsNotEmpty({ message: 'Username should not be empty.' })
  @Length(USER_NAME_MIN_LENGTH, USER_NAME_MAX_LENGTH, {
    message: `Username must be between ${USER_NAME_MIN_LENGTH} and ${USER_NAME_MAX_LENGTH} characters long.`,
  })
  userName!: string;

  @ApiPropertyOptional({
    description: 'Primeiro nome do usuário',
    example: 'João',
    minLength: USER_FIRST_NAME_MIN_LENGTH,
    maxLength: USER_FIRST_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(USER_FIRST_NAME_MIN_LENGTH, USER_FIRST_NAME_MAX_LENGTH, {
    message: `First name must be between ${USER_FIRST_NAME_MIN_LENGTH} and ${USER_FIRST_NAME_MAX_LENGTH} characters long.`,
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Sobrenome do usuário',
    example: 'Silva',
    minLength: USER_LAST_NAME_MIN_LENGTH,
    maxLength: USER_LAST_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(USER_LAST_NAME_MIN_LENGTH, USER_LAST_NAME_MAX_LENGTH, {
    message: 'Last name must be between 2 and 255 characters long.',
  })
  lastName?: string;

  @ApiProperty({
    description: 'Endereço de e-mail válido',
    example: 'joao.silva@email.com',
    format: 'email',
  })
  @TrimAndLowerCase()
  @IsString()
  @IsEmail({}, { message: 'This email address is not a valid address.' })
  email!: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: 'senhaSegura123',
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString()
  @Length(USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_MAX_LENGTH, {
    message: 'The password must be between 6 and 50 characters long.',
  })
  password!: string;
}
