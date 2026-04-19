import { EntityManager } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserName } from '../value-objects/user-name.value-object';
import { Email } from '../value-objects/email.value-object';
import { AuthProviderType } from '@/common/models/enums';

export interface IRepositoryOptions {
  manager?: EntityManager;
}

export abstract class IUserRepository {
  abstract findById(id: string, options?: IRepositoryOptions): Promise<User | null>;
  abstract findByEmail(email: Email, options?: IRepositoryOptions): Promise<User | null>;
  abstract findByUserName(userName: UserName, options?: IRepositoryOptions): Promise<User | null>;
  abstract findByAuthProvider(
    provider: AuthProviderType,
    providerUserId: string,
    options?: IRepositoryOptions,
  ): Promise<User | null>;
  abstract save(user: User, options?: IRepositoryOptions): Promise<User>;
}
