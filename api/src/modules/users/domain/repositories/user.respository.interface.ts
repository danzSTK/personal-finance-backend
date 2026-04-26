import { AuthProviderType } from '@/common/models/enums';
import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { User } from '../entities/user.entity';
import { Email } from '../value-objects/email.value-object';
import { UserName } from '../value-objects/user-name.value-object';

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
