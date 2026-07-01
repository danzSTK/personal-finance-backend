import {
  USER_FIRST_NAME_MAX_LENGTH,
  USER_FIRST_NAME_MIN_LENGTH,
  USER_LAST_NAME_MAX_LENGTH,
  USER_LAST_NAME_MIN_LENGTH,
} from '@/common/models/constants';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { InvalidUserError } from '@/modules/users/domain/errors/invalid-user.error';
import { UserCreatedEvent } from '@/modules/users/domain/events/user-created.event';
import { UserEmailVerifiedEvent } from '@/modules/users/domain/events/user-email-verified.event';
import { UserAvatarUpdatedEvent } from '@/modules/users/domain/events/user-avatar-updated.event';
import { UserAvatarRemovedEvent } from '@/modules/users/domain/events/user-avatar-removed.event';
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
  avatarAssetId: string | null;
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

  get avatarAssetId(): string | null {
    return this.props.avatarAssetId;
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

  changerFirstName(newFirstName: string | null): void {
    if (this.props.firstName === newFirstName) {
      return;
    }

    User.validateFirstName(newFirstName);

    this.props.firstName = newFirstName ? newFirstName.trim() : null;
    this.props.updatedAt = new Date();
  }

  changerLastName(newLastName: string | null): void {
    if (this.props.lastName === newLastName) {
      return;
    }

    User.validateLastName(newLastName);

    this.props.lastName = newLastName ? newLastName.trim() : null;
    this.props.updatedAt = new Date();
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

  markEmailVerified(): void {
    if (this.props.status === UserStatus.ACTIVE) {
      return;
    }

    if (this.props.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      throw new InvalidUserError(`Cannot verify email for user with status ${this.props.status}.`);
    }

    this.props.status = UserStatus.ACTIVE;
    this.props.updatedAt = new Date();
    this.addDomainEvent(UserEmailVerifiedEvent.create(this.id, this.email));
  }

  changeUserName(newUserName: UserName): void {
    if (this.props.userName?.equals(newUserName)) {
      return;
    }

    this.props.userName = newUserName;
    this.props.updatedAt = new Date();
  }

  changeAvatarAsset(currentAssetId: string): string | null {
    const normalizedAssetId = currentAssetId.trim();

    if (!normalizedAssetId) {
      throw new InvalidUserError('Avatar asset id cannot be empty.');
    }

    const previousAssetId = this.props.avatarAssetId;

    if (previousAssetId === normalizedAssetId) {
      return previousAssetId;
    }

    this.props.avatarAssetId = normalizedAssetId;
    this.props.updatedAt = new Date();
    this.addDomainEvent(UserAvatarUpdatedEvent.create(this.id, previousAssetId, normalizedAssetId));

    return previousAssetId;
  }

  removeAvatarAsset(): string | null {
    const previousAssetId = this.props.avatarAssetId;

    if (!previousAssetId) {
      return null;
    }

    this.props.avatarAssetId = null;
    this.props.updatedAt = new Date();
    this.addDomainEvent(UserAvatarRemovedEvent.create(this.id, previousAssetId));

    return previousAssetId;
  }

  get jsonObject() {
    return {
      id: this.id,
      userName: this.userName?.value,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email.value,
      status: this.status,
      avatarAssetId: this.avatarAssetId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  private static validateFirstName(firstName: string | null): void {
    if (firstName === null) {
      return;
    }

    const length = firstName.trim().length;

    if (length < USER_FIRST_NAME_MIN_LENGTH || length > USER_FIRST_NAME_MAX_LENGTH) {
      throw new InvalidUserError('First name must be between 2 and 255 characters long.');
    }
  }

  private static validateLastName(lastName: string | null): void {
    if (lastName === null) {
      return;
    }

    const length = lastName.trim().length;

    if (length < USER_LAST_NAME_MIN_LENGTH || length > USER_LAST_NAME_MAX_LENGTH) {
      throw new InvalidUserError('Last name must be between 2 and 255 characters long.');
    }
  }
}
