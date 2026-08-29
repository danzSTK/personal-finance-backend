import { BcryptHashService } from '@/common/bcrypt-hash.service';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { ENTITIES } from '@/config/entities';
import { AuthProviderAlreadyLinkedError } from '@/modules/auth/application/errors';
import { LinkEmailProviderUseCase } from '@/modules/auth/application/use-cases/link-email-provider/link-email-provider.use-case';
import { ValidateCredentialsUseCase } from '@/modules/auth/application/use-cases/validate-credentials/validate-credentials.use-case';
import { FindUserByEmailUseCase } from '@/modules/users/application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { AuthProviderFactory } from '@/modules/users/domain/factories/auth-provider.factory';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import { UserRepository } from '@/modules/users/infrastructure/persistence/user.repository';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

describe('Link EMAIL provider real flow integration', () => {
  let postgres: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let hashService: BcryptHashService;
  let linkEmailProvider: LinkEmailProviderUseCase;
  let validateCredentials: ValidateCredentialsUseCase;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    dataSource = new DataSource({
      type: 'postgres',
      url: postgres.getConnectionUri(),
      entities: ENTITIES,
      migrations: [join(process.cwd(), 'src/database/migrations/*{.ts,.js}')],
      synchronize: false,
      logging: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    userRepository = new UserRepository(dataSource.getRepository(UserOrmEntity));
    hashService = new BcryptHashService();
    linkEmailProvider = new LinkEmailProviderUseCase(userRepository, hashService, dataSource);
    validateCredentials = new ValidateCredentialsUseCase(new FindUserByEmailUseCase(userRepository), hashService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await postgres?.stop();
  });

  it('links the persisted primary email and enables local login with the new password', async () => {
    const fixture = await createGoogleOnlyUser();

    await linkEmailProvider.execute({ userId: fixture.userId, password: fixture.password });

    const authenticated = await validateCredentials.execute({
      email: fixture.email,
      password: fixture.password,
    });
    const legacyAlternateLogin = await validateCredentials.execute({
      email: `legacy-${randomUUID()}@example.com`,
      password: fixture.password,
    });
    const providers = await dataSource.query<
      Array<{ provider: AuthProviderType; provider_user_id: string; password_hash: string | null }>
    >(
      `
        SELECT provider, provider_user_id, password_hash
        FROM auth_providers
        WHERE user_id = $1
      `,
      [fixture.userId],
    );
    const provider = providers.find(item => item.provider === AuthProviderType.EMAIL);
    const [persistedUser] = await dataSource.query<Array<{ email: string; status: UserStatus }>>(
      'SELECT email, status FROM users WHERE id = $1',
      [fixture.userId],
    );

    expect(authenticated?.id).toBe(fixture.userId);
    expect(legacyAlternateLogin).toBeNull();
    expect(providers.map(item => item.provider).sort()).toEqual(
      [AuthProviderType.EMAIL, AuthProviderType.GOOGLE].sort(),
    );
    expect(provider?.provider_user_id).toBe(fixture.email);
    expect(provider?.password_hash).not.toBeNull();
    await expect(hashService.compare(fixture.password, provider?.password_hash ?? '')).resolves.toBe(true);
    expect(persistedUser).toEqual({ email: fixture.email, status: UserStatus.PENDING_PROFILE });
  });

  it('serializes concurrent attempts and persists at most one EMAIL provider', async () => {
    const fixture = await createGoogleOnlyUser();

    const results = await Promise.allSettled([
      linkEmailProvider.execute({ userId: fixture.userId, password: fixture.password }),
      linkEmailProvider.execute({ userId: fixture.userId, password: fixture.password }),
    ]);
    const fulfilled = results.filter(result => result.status === 'fulfilled');
    const rejected = results.filter(result => result.status === 'rejected');
    const rejectionReason: unknown = rejected[0]?.status === 'rejected' ? rejected[0].reason : undefined;
    const [{ count }] = await dataSource.query<Array<{ count: string }>>(
      'SELECT count(*) FROM auth_providers WHERE user_id = $1 AND provider = $2',
      [fixture.userId, AuthProviderType.EMAIL],
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejectionReason).toBeInstanceOf(AuthProviderAlreadyLinkedError);
    expect(Number(count)).toBe(1);
  });

  async function createGoogleOnlyUser(): Promise<{ userId: string; email: string; password: string }> {
    const userId = randomUUID();
    const email = `link-email-${randomUUID()}@example.com`;
    const password = `Strong-${randomUUID()}!`;
    const now = new Date();
    const googleProvider = AuthProviderFactory.create(
      {
        provider: AuthProviderType.GOOGLE,
        providerUserId: randomUUID(),
        passwordHash: null,
        userId,
        createdAt: now,
        updatedAt: now,
      },
      randomUUID(),
    );
    const user = User.reconstitute(
      {
        userName: null,
        firstName: null,
        lastName: null,
        email: Email.reconstitute(email),
        status: UserStatus.PENDING_PROFILE,
        avatarAssetId: null,
        authProviders: [googleProvider],
        credentialVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );

    await userRepository.save(user);

    return { userId, email, password };
  }
});
