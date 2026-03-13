import { UserStatus } from '../../../../common/models/enums';
import { Email } from '../value-objects/email.value-object';
import { UserName } from '../value-objects/user-name.value-object';
import { AuthProvider } from './auth-provider.entity';

export interface UserProps {
  userName: UserName | null;
  firstName: string | null;
  lastName: string | null;
  email: Email;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  authProvider: AuthProvider[];
}

export class User {
  constructor(
    private readonly props: UserProps,
    public readonly id: string,
  ) {}

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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get authProvider(): AuthProvider[] {
    return this.props.authProvider;
  }

  static create(props: UserProps, id: string) {
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
