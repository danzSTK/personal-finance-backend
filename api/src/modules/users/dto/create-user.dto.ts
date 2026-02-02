import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserStatus } from '../../../common/models/enums/user-status.enum';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @MinLength(3)
  userName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
