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

  get provider(): AuthProviderType {
    return this.props.provider;
  }

  get providerUserId(): string {
    return this.props.providerUserId;
  }

  get passwordHash(): HashedPassword | null {
    return this.props.passwordHash;
  }

  get userId(): string {
    return this.props.userId;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
