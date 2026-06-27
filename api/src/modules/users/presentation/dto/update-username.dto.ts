import { TrimAndLowerCase } from '@/common/decorators/normalize-string.decorator';
import { USER_NAME_MAX_LENGTH, USER_NAME_MIN_LENGTH } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class UpdateUsernameDto {
  @ApiProperty({
    description: 'Novo nome de usuário único para identificação',
    example: 'new_username',
    minLength: USER_NAME_MIN_LENGTH,
    maxLength: USER_NAME_MAX_LENGTH,
  })
  @IsString()
  @TrimAndLowerCase()
  @IsNotEmpty({ message: 'Username should not be empty.' })
  @Length(USER_NAME_MIN_LENGTH, USER_NAME_MAX_LENGTH, {
    message: `Username must be between ${USER_NAME_MIN_LENGTH} and ${USER_NAME_MAX_LENGTH} characters long.`,
  })
  username!: string;
}
