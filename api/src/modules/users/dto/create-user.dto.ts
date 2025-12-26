import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsOptional()
  @IsString({ message: 'O userName deve ser uma string' })
  @MaxLength(255, { message: 'O userName deve ter no máximo 255 caracteres' })
  @MinLength(3, { message: 'O userName deve ter no mínimo 3 caracteres' })
  userName?: string;

  @IsOptional()
  @IsString({ message: 'O firstName deve ser uma string' })
  @MinLength(1, { message: 'O firstName deve ter no mínimo 1 caractere' })
  @MaxLength(255, { message: 'O firstName deve ter no máximo 255 caracteres' })
  firstName?: string;

  @IsOptional()
  @IsString({ message: 'O lastName deve ser uma string' })
  @MinLength(1, { message: 'O lastName deve ter no mínimo 1 caractere' })
  @MaxLength(255, { message: 'O lastName deve ter no máximo 255 caracteres' })
  lastName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Endereço de email inválido' })
  email?: string;
}
