import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { TrimAndLowerCase } from '@/common/decorators/normalize-string.decorator';
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
    description: 'Senha do usuário',
    example: 'senhaSegura123',
    format: 'password',
  })
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
