import { AuthProviderType } from '../../../../common/models/enums';
import { HashedPassword } from '../value-objects/hashed-password.value-object';

export interface AuthProviderProps {
  provider: AuthProviderType;
  providerUserId: string;
  passwordHash: HashedPassword | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class AuthProvider {
  constructor(
    protected readonly props: AuthProviderProps,
    public readonly id: string,
  ) {
    this.validate();
  }

  protected abstract validate(): void;

  isSameProvider(provider: AuthProviderType, providerUserId: string): boolean {
    return this.props.provider === provider && this.props.providerUserId === providerUserId;
  }

  get provider() {
    return this.props.provider;
  }

  get providerUserId() {
    return this.props.providerUserId;
  }

  get userId() {
    return this.props.userId;
  }
  get createdAt() {
    return this.props.createdAt;
  }
  get updatedAt() {
    return this.props.updatedAt;
  }
}
