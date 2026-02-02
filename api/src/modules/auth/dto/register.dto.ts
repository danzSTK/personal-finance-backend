import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Username should not be empty.' })
  @Length(3, 100, {
    message: 'Username must be between 3 and 100 characters long.',
  })
  userName: string;

  @IsOptional()
  @IsString()
  @Length(2, 255, {
    message: 'First name must be between 2 and 255 characters long.',
  })
  firstName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 255, {
    message: 'Last name must be between 2 and 255 characters long.',
  })
  lastName?: string;

  @IsString()
  @IsEmail({}, { message: 'This email address is not a valid address.' })
  email: string;

  @IsString()
  @Length(6, 50, {
    message: 'The password must be between 6 and 50 characters long.',
  })
  password: string;
}
