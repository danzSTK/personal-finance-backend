import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_FIRST_NAME_MIN_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_LAST_NAME_MIN_LENGTH,
} from '@/common/models/constants';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({
    description: 'Primeiro nome. Envie null para remover o valor atual.',
    example: 'Daniel',
    nullable: true,
    minLength: USER_FIRST_NAME_MIN_LENGTH,
    maxLength: USER_FIRST_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(USER_FIRST_NAME_MIN_LENGTH, USER_FIRST_NAME_MAX_LENGTH, {
    message: `User First name must be between ${USER_FIRST_NAME_MIN_LENGTH} and ${USER_FIRST_NAME_MAX_LENGTH} characters long.`,
  })
  firstName?: string | null;

  @ApiPropertyOptional({
    description: 'Sobrenome. Envie null para remover o valor atual.',
    example: 'Silva',
    nullable: true,
    minLength: USER_LAST_NAME_MIN_LENGTH,
    maxLength: USER_LAST_NAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @Length(USER_LAST_NAME_MIN_LENGTH, USER_LAST_NAME_MAX_LENGTH, {
    message: `User Last name must be between ${USER_LAST_NAME_MIN_LENGTH} and ${USER_LAST_NAME_MAX_LENGTH} characters long.`,
  })
  lastName?: string | null;
}
