import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { TrimAndLowerCase } from '@/common/decorators/normalize-string.decorator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { USER_NAME_MAX_LENGTH, USER_NAME_MIN_LENGTH } from '@/common/models/constants';

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
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(2, 255, {
    message: 'First name must be between 2 and 255 characters long.',
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Sobrenome do usuário',
    example: 'Silva',
    minLength: 2,
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @Length(2, 255, {
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
    minLength: 6,
    maxLength: 50,
    format: 'password',
  })
  @IsString()
  @Length(6, 50, {
    message: 'The password must be between 6 and 50 characters long.',
  })
  password!: string;
}
