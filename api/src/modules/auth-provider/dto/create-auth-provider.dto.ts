import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { AuthProviderType } from '../../../common/models/enums/auth-provider.enum';

export class CreateAuthProviderDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  @IsEnum(AuthProviderType)
  provider: AuthProviderType;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  providerUserId: string;

  @IsOptional()
  @IsString()
  @Length(1, 255)
  passwordHash?: string | null;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  user_id: string;
}
