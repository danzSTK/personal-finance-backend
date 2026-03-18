import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { TrimAndLowerCase } from '../../../../common/decorators/normalize-string.decorator';
import { ApiProperty } from '@nestjs/swagger';

export class LinkEmailProviderDto {
  @ApiProperty({
    description: 'Endereço de e-mail válido',
    example: 'joao.silva@email.com',
    format: 'email',
  })
  @TrimAndLowerCase()
  @IsString()
  @IsEmail({}, { message: 'This email address is not a valid address.' })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: 'senhaSegura123',
    minLength: 6,
    maxLength: 50,
    format: 'password',
  })
  @IsString()
  @IsNotEmpty({ message: 'Password should not be empty.' })
  @Length(6, 50, {
    message: 'The password must be between 6 and 50 characters long.',
  })
  password: string;
}
