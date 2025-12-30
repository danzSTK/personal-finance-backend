import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class LoginEmailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @Length(6, 50, {
    message: 'Password must be between 6 and 50 characters long',
  })
  password: string;
}
