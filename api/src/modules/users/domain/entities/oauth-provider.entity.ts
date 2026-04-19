import { AuthProviderType } from '@/common/models/enums';
import { AuthProvider, AuthProviderProps } from './auth-provider.entity';

const OAUTH_PROVIDERS = [AuthProviderType.GOOGLE];

export class OAuthProvider extends AuthProvider {
  protected validate(): void {
    if (!OAUTH_PROVIDERS.includes(this.props.provider)) {
      throw new Error('Invalid OAuth provider');
    }

    if (this.props.passwordHash !== null) {
      throw new Error('Password hash should be null for OAuth providers');
    }

    if (!this.props.providerUserId) {
      throw new Error('Provider user ID is required for OAuth providers');
    }
  }

  static create(props: AuthProviderProps, id: string): OAuthProvider {
    return new OAuthProvider(props, id);
  }
}
