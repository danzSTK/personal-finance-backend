import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'O userName deve ser uma string' })
  @IsNotEmpty({ message: 'O userName não pode estar vazio' })
  @MaxLength(255, { message: 'O userName deve ter no máximo 255 caracteres' })
  @MinLength(3, { message: 'O userName deve ter no mínimo 3 caracteres' })
  userName: string;

  @IsString({ message: 'O firstName deve ser uma string' })
  @IsOptional()
  @MaxLength(255, { message: 'O firstName deve ter no máximo 255 caracteres' })
  @MinLength(1, { message: 'O firstName deve ter no mínimo 1 caractere' })
  firstName?: string;

  @IsString({ message: 'O lastName deve ser uma string' })
  @IsOptional()
  @MaxLength(255, { message: 'O lastName deve ter no máximo 255 caracteres' })
  @MinLength(1, { message: 'O lastName deve ter no mínimo 1 caractere' })
  lastName?: string;

  @IsEmail({}, { message: 'Endereço de email inválido' })
  @IsOptional()
  email?: string;
}
