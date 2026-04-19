import { AuthProviderType } from '@/common/models/enums';
import { AuthProvider, AuthProviderProps } from '../entities/auth-provider.entity';
import { CredentialsAuthProvider } from '../entities/credentials-auth-provider.entity';
import { OAuthProvider } from '../entities/oauth-provider.entity';

export class AuthProviderFactory {
  static create(props: AuthProviderProps, id: string): AuthProvider {
    switch (props.provider) {
      case AuthProviderType.EMAIL:
        return new CredentialsAuthProvider(props, id);
      case AuthProviderType.GOOGLE:
        return new OAuthProvider(props, id);
      default:
        throw new Error(`Unknown provider: ${props.provider}`);
    }
  }
}
