import { USER_PASSWORD_MAX_LENGTH, USER_PASSWORD_MIN_LENGTH } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ChangeUserPasswordDto {
  @ApiProperty({
    description: 'Senha atual da conta local',
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString()
  @Length(USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @ApiProperty({
    description: 'Nova senha da conta local',
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    format: 'password',
  })
  @IsString()
  @Length(USER_PASSWORD_MIN_LENGTH, USER_PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
