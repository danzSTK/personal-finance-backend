import { PasswordByteLimitExceededError } from '@/common/domain/errors';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { ValidateCredentialsUseCase } from '@/modules/auth/application/use-cases/validate-credentials/validate-credentials.use-case';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly validateCredentialsUseCase: ValidateCredentialsUseCase) {
    super({
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  async validate(email: string, password: string) {
    try {
      const user = await this.validateCredentialsUseCase.execute({ email, password });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return user;
    } catch (error) {
      if (error instanceof PasswordByteLimitExceededError) {
        throw new UnauthorizedException('Invalid credentials');
      }

      throw error;
    }
  }
}
