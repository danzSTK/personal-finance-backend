import { BadRequestException } from '@nestjs/common';
import { AuthProvider, AuthProviderProps } from './auth-provider.entity';
import { USER_EMAIL_REGEX } from '../../../../common/models/constants';
import { HashedPassword } from '../value-objects/hashed-password.value-object';

export class CredentialsAuthProvider extends AuthProvider {
  protected validate(): void {
    if (!this.props.passwordHash) {
      throw new BadRequestException('Password hash is required');
    }

    if (!USER_EMAIL_REGEX.test(this.props.providerUserId)) {
      throw new BadRequestException('Invalid email format');
    }
  }

  get passwordHash(): HashedPassword {
    return this.props.passwordHash!;
  }

  static create(props: AuthProviderProps, id: string): CredentialsAuthProvider {
    return new CredentialsAuthProvider(props, id);
  }
}
