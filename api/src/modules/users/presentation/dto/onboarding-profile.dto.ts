import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

/**
 * DTO para completar o perfil do usuário durante o onboarding.
 * Contém os campos obrigatórios que o usuário deve fornecer.
 * O minimo necessário para o User sair do status PENDING_PROFILE e se tornar usual do sistema.
 */
export class OnboardingProfileDto {
  @IsString({ message: 'O userName deve ser uma string' })
  @IsNotEmpty({ message: 'O userName não pode estar vazio' })
  @Length(3, 255, {
    message: 'O userName deve ter entre 3 e 255 caracteres',
  })
  userName: string;

  @IsString({ message: 'O email deve ser uma string' })
  @IsEmail({}, { message: 'Endereço de email inválido' })
  @IsNotEmpty({ message: 'O email não pode estar vazio' })
  email: string;
}
