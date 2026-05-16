import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { AggregateRoot } from '@/shared/domain/aggregate-root';
import { ConflictException } from '@nestjs/common';
import { AuthProviderFactory } from '../factories/auth-provider.factory';
import { Email } from '../value-objects/email.value-object';
import { HashedPassword } from '../value-objects/hashed-password.value-object';
import { UserName } from '../value-objects/user-name.value-object';
import { AuthProvider } from './auth-provider.entity';
import { CredentialsAuthProvider } from './credentials-auth-provider.entity';

export interface UserProps {
  userName: UserName | null;
  firstName: string | null;
  lastName: string | null;
  email: Email;
  status: UserStatus;
  authProviders: AuthProvider[];
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot {
  constructor(
    private readonly props: UserProps,
    public readonly id: string,
  ) {
    super();
  }

  get userName(): UserName | null {
    return this.props.userName;
  }

  get firstName(): string | null {
    return this.props.firstName;
  }

  get lastName(): string | null {
    return this.props.lastName;
  }

  get email(): Email {
    return this.props.email;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  get authProviders(): ReadonlyArray<AuthProvider> {
    return this.props.authProviders;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  hasAuthProvider(provider: AuthProviderType, providerUserId: string): boolean {
    return this.props.authProviders.some(authProvider => authProvider.isSameProvider(provider, providerUserId));
  }

  getAuthProvider(provider: AuthProviderType, providerUserId: string): AuthProvider | null {
    return this.props.authProviders.find(ap => ap.isSameProvider(provider, providerUserId)) ?? null;
  }

  getCredentialsAuthProvider(): CredentialsAuthProvider | null {
    return (
      (this.props.authProviders.find(ap => ap.provider === AuthProviderType.EMAIL) as CredentialsAuthProvider | null) ??
      null
    );
  }

  addAuthProvider(
    id: string,
    provider: AuthProviderType,
    providerUserId: string,
    passwordHash: HashedPassword | null,
  ): void {
    if (this.hasAuthProvider(provider, providerUserId)) {
      throw new ConflictException(`Auth provider ${provider} with user id ${providerUserId} already exists`);
    }

    const authProvider = AuthProviderFactory.create(
      {
        provider,
        providerUserId,
        passwordHash,
        userId: this.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      id,
    );

    this.props.authProviders.push(authProvider);
    this.props.updatedAt = new Date();
  }

  static create(props: UserProps, id: string) {
    const user = new User(props, id);

    user.addDomainEvent(UserCreatedEvent.create(user.id, user.status, user.email));

    return user;
  }

  static reconstitute(props: UserProps, id: string) {
    return new User(props, id);
  }

  get jsonObject() {
    return {
      id: this.id,
      userName: this.userName?.value,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email.value,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
