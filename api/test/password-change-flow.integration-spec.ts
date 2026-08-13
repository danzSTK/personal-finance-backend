import { Email } from '@/common/domain/value-objects/email.value-object';
import { BcryptHashService } from '@/common/bcrypt-hash.service';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { AuthRequest } from '@/common/models/interfaces/auth-request.interface';
import { CacheKeys } from '@/common/utils/cache-keys.factory';
import { ENTITIES } from '@/config/entities';
import { RedisService } from '@/database/redis/redis.service';
import { PasswordChangeStateLoadResultKind } from '@/modules/auth/application/ports/password-change-state-store.interface';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import { PasswordChangeStateSynchronizer } from '@/modules/auth/application/services/password-change-state-synchronizer';
import { PasswordChangeStateAssembler } from '@/modules/auth/application/services/password-change-state.assembler';
import { ChangeUserPasswordUseCase } from '@/modules/auth/application/use-cases/change-user-password/change-user-password.use-case';
import { GetPasswordChangeStatusUseCase } from '@/modules/auth/application/use-cases/get-password-change-status/get-password-change-status.use-case';
import { ValidateCredentialsUseCase } from '@/modules/auth/application/use-cases/validate-credentials/validate-credentials.use-case';
import {
  PasswordChangeEventType,
  PASSWORD_CHANGE_COMPLETED_WINDOW_MS,
} from '@/modules/auth/domain/constants/password-change.constants';
import { PasswordChangeStateRefreshRequestedEvent } from '@/modules/auth/domain/events/password-change-state-refresh-requested.event';
import { PasswordChangedEvent } from '@/modules/auth/domain/events/password-changed.event';
import { UserSessionsRevokeAllRequestedEvent } from '@/modules/auth/domain/events/user-sessions-revoke-all-requested.event';
import { ChangePasswordPolicy } from '@/modules/auth/domain/policies/change-password.policy';
import { RedisPasswordChangeStateStore } from '@/modules/auth/infrastructure/cache/redis-password-change-state-store';
import { PasswordChangeEventOrmEntity } from '@/modules/auth/infrastructure/persistence/password-change-event-orm.entity';
import { PasswordChangeEventRepository } from '@/modules/auth/infrastructure/persistence/password-change-event.repository';
import { RedisSessionRepository } from '@/modules/auth/infrastructure/persistence/redis-session.repository';
import { JwtRefreshStrategy } from '@/modules/auth/infrastructure/strategies/jwt-refresh.strategy';
import { JwtStrategy } from '@/modules/auth/infrastructure/strategies/jwt.strategy';
import { JwtPayloadDto } from '@/modules/auth/presentation/dto/jwt-payload.dto';
import { FindUserByEmailUseCase } from '@/modules/users/application/use-cases/find-by-user-email/find-user-by-email.use-case';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { AuthProviderFactory } from '@/modules/users/domain/factories/auth-provider.factory';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { RedisUserCacheInvalidator } from '@/modules/users/infrastructure/cache/redis-user-cache-invalidator';
import { CachedUserRepository } from '@/modules/users/infrastructure/persistence/cached-user.repository';
import { UserOrmEntity } from '@/modules/users/infrastructure/persistence/user-orm-entity';
import { UserRepository } from '@/modules/users/infrastructure/persistence/user.repository';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { OutboxMessageOrmEntity } from '@/shared/outbox/persistence/outbox-message-orm.entity';
import { OutboxMessageRepository } from '@/shared/outbox/persistence/outbox-message.repository';
import { UnauthorizedException } from '@nestjs/common';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

interface PasswordChangeFixture {
  userId: string;
  email: string;
  sessionId: string;
  currentPassword: string;
  newPassword: string;
}

interface PersistedCredentialRow {
  credential_version: number;
  password_hash: string;
}

interface PersistedOutboxRow {
  event_name: string;
  aggregate_id: string;
  deduplication_key: string | null;
  payload: Record<string, unknown>;
}

describe('Password change real flow integration', () => {
  const redisPassword = 'password-change-flow-integration';
  const jwtConfiguration = {
    accessSecret: 'integration-access-secret-at-least-32-characters',
    refreshSecret: 'integration-refresh-secret-at-least-32-characters',
    accessExpiresIn: '15m',
    refreshExpiresIn: '7d',
    issuer: 'https://integration.example.com',
  };

  let postgres: StartedPostgreSqlContainer;
  let redisContainer: StartedRedisContainer;
  let dataSource: DataSource;
  let redisClient: Redis;
  let redisService: RedisService;
  let hashService: BcryptHashService;
  let userRepository: CachedUserRepository;
  let eventRepository: PasswordChangeEventRepository;
  let stateStore: RedisPasswordChangeStateStore;
  let sessionRepository: RedisSessionRepository;
  let changePassword: ChangeUserPasswordUseCase;
  let getPasswordChangeStatus: GetPasswordChangeStatusUseCase;
  let validateCredentials: ValidateCredentialsUseCase;
  let jwtStrategy: JwtStrategy;
  let jwtRefreshStrategy: JwtRefreshStrategy;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    redisContainer = await new RedisContainer('redis:7-alpine').withPassword(redisPassword).start();

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

    redisClient = new Redis({
      host: redisContainer.getHost(),
      port: redisContainer.getPort(),
      password: redisPassword,
      maxRetriesPerRequest: 1,
    });
    redisService = new RedisService(redisClient);
    hashService = new BcryptHashService();

    const baseUserRepository = new UserRepository(dataSource.getRepository(UserOrmEntity));
    const cacheInvalidator = new RedisUserCacheInvalidator(redisService);
    userRepository = new CachedUserRepository(baseUserRepository, redisService, cacheInvalidator);
    eventRepository = new PasswordChangeEventRepository(dataSource.getRepository(PasswordChangeEventOrmEntity));
    stateStore = new RedisPasswordChangeStateStore(redisService);
    sessionRepository = new RedisSessionRepository(redisService);

    const assembler = new PasswordChangeStateAssembler();
    const stateLoader = new PasswordChangeStateLoader(stateStore, eventRepository, assembler);
    const stateSynchronizer = new PasswordChangeStateSynchronizer(eventRepository, stateStore, assembler);
    const outboxRepository = new OutboxMessageRepository(dataSource.getRepository(OutboxMessageOrmEntity));
    const outboxWriteService = new OutboxWriteService(outboxRepository);

    const changePasswordPolicy = new ChangePasswordPolicy();
    changePassword = new ChangeUserPasswordUseCase(
      dataSource,
      userRepository,
      eventRepository,
      stateStore,
      stateLoader,
      stateSynchronizer,
      changePasswordPolicy,
      hashService,
      sessionRepository,
      outboxWriteService,
    );
    getPasswordChangeStatus = new GetPasswordChangeStatusUseCase(stateLoader, changePasswordPolicy);

    const findUserByEmail = new FindUserByEmailUseCase(userRepository);
    const findUserById = new FindUserByIdUseCase(userRepository);
    validateCredentials = new ValidateCredentialsUseCase(findUserByEmail, hashService);
    jwtStrategy = new JwtStrategy(findUserById, userRepository, sessionRepository, jwtConfiguration);
    jwtRefreshStrategy = new JwtRefreshStrategy(jwtConfiguration, sessionRepository, userRepository);
  });

  afterAll(async () => {
    if (redisService) {
      await redisService.onApplicationShutdown();
    }

    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }

    await Promise.all([postgres?.stop(), redisContainer?.stop()]);
  });

  beforeEach(async () => {
    await redisClient.flushdb();
  });

  it('persists the new credential and authenticates only the new password', async () => {
    const fixture = await createFixture();

    await expect(getPasswordChangeStatus.execute({ userId: fixture.userId })).resolves.toEqual({ status: true });

    const userBeforeChange = await validateCredentials.execute({
      email: fixture.email,
      password: fixture.currentPassword,
    });
    expect(userBeforeChange?.id).toBe(fixture.userId);

    await expect(executeChange(fixture)).resolves.toEqual({ status: 'CHANGED' });

    const userWithOldPassword = await validateCredentials.execute({
      email: fixture.email,
      password: fixture.currentPassword,
    });
    const userWithNewPassword = await validateCredentials.execute({
      email: fixture.email,
      password: fixture.newPassword,
    });
    expect(userWithOldPassword === null).toBe(true);
    expect(userWithNewPassword?.id).toBe(fixture.userId);

    const [credential] = await dataSource.query<PersistedCredentialRow[]>(
      `
        SELECT users.credential_version, providers.password_hash
        FROM users
        INNER JOIN auth_providers AS providers ON providers.user_id = users.id
        WHERE users.id = $1 AND providers.provider = $2
      `,
      [fixture.userId, AuthProviderType.EMAIL],
    );

    expect(credential.credential_version).toBe(2);
    await expect(hashService.compare(fixture.currentPassword, credential.password_hash)).resolves.toBe(false);
    await expect(hashService.compare(fixture.newPassword, credential.password_hash)).resolves.toBe(true);

    const events = await eventRepository.findRelevantEvents(
      fixture.userId,
      new Date(Date.now() - PASSWORD_CHANGE_COMPLETED_WINDOW_MS),
    );
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(PasswordChangeEventType.PASSWORD_CHANGED);

    const outbox = await loadOutbox(fixture.userId);
    expect(outbox.map(row => row.event_name).sort()).toEqual(
      [
        PasswordChangeStateRefreshRequestedEvent.eventName,
        PasswordChangedEvent.eventName,
        UserSessionsRevokeAllRequestedEvent.eventName,
      ].sort(),
    );
    expect(outbox.every(row => row.aggregate_id === fixture.userId)).toBe(true);
    expect(outbox.every(row => row.deduplication_key !== null)).toBe(true);

    expect(
      containsSensitiveValue(outbox, [fixture.currentPassword, fixture.newPassword, credential.password_hash]),
    ).toBe(false);

    const state = await stateStore.load(fixture.userId, new Date());
    expect(state.kind).toBe(PasswordChangeStateLoadResultKind.READY);
    if (state.kind !== PasswordChangeStateLoadResultKind.READY) {
      throw new Error('Expected a ready password change projection.');
    }
    expect(state.state.completedChangesAt).toHaveLength(1);
    await expect(redisClient.exists(CacheKeys.auth.passwordChange.pending(fixture.userId))).resolves.toBe(0);

    const statusAfterChange = await getPasswordChangeStatus.execute({ userId: fixture.userId });
    expect(statusAfterChange.status).toBe(false);
    if (statusAfterChange.status) {
      throw new Error('Expected password change to be unavailable during cooldown.');
    }
    expect(statusAfterChange.retryAfterSeconds).toBeGreaterThan(0);
    expect(statusAfterChange.retryAfterSeconds).toBeLessThanOrEqual(600);
  });

  it('removes previous sessions and rejects access and refresh payloads with the old credential version', async () => {
    const fixture = await createFixture();
    const legacyPayload: JwtPayloadDto = {
      sub: fixture.userId,
      jti: fixture.sessionId,
      email: fixture.email,
      status: UserStatus.ACTIVE,
      credentialVersion: 1,
    };

    await expect(sessionRepository.sessionExists(fixture.userId, fixture.sessionId)).resolves.toBe(true);
    await expect(executeChange(fixture)).resolves.toEqual({ status: 'CHANGED' });
    await expect(sessionRepository.sessionExists(fixture.userId, fixture.sessionId)).resolves.toBe(false);

    await expect(jwtStrategy.validate({ cookies: {} } as AuthRequest, legacyPayload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(jwtRefreshStrategy.validate(legacyPayload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  async function createFixture(): Promise<PasswordChangeFixture> {
    const userId = randomUUID();
    const providerId = randomUUID();
    const sessionId = randomUUID();
    const suffix = randomUUID();
    const email = `password-change-${suffix}@example.com`;
    const currentPassword = `Old-${suffix}-password!`;
    const newPassword = `New-${suffix}-password!`;
    const passwordHash = await hashService.hash(currentPassword);
    const now = new Date();
    const provider = AuthProviderFactory.create(
      {
        provider: AuthProviderType.EMAIL,
        providerUserId: email,
        passwordHash: HashedPassword.reconstitute(passwordHash),
        userId,
        createdAt: now,
        updatedAt: now,
      },
      providerId,
    );
    const user = User.reconstitute(
      {
        userName: null,
        firstName: 'Integration',
        lastName: 'Password',
        email: Email.reconstitute(email),
        status: UserStatus.ACTIVE,
        avatarAssetId: null,
        authProviders: [provider],
        credentialVersion: 1,
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );

    await userRepository.save(user);
    await sessionRepository.createSession(
      userId,
      sessionId,
      {
        browser: 'Jest',
        os: 'Linux',
        device: 'Integration runner',
        ip: '127.0.0.1',
        location: 'Integration',
        loginAt: now.toISOString(),
      },
      3_600,
    );

    return {
      userId,
      email,
      sessionId,
      currentPassword,
      newPassword,
    };
  }

  function executeChange(fixture: PasswordChangeFixture) {
    return changePassword.execute({
      userId: fixture.userId,
      currentPassword: fixture.currentPassword,
      newPassword: fixture.newPassword,
      sessionId: fixture.sessionId,
      ipAddress: '127.0.0.1',
      userAgent: 'Jest integration runner',
      metadata: {
        browser: 'Jest',
        os: 'Linux',
        device: 'Integration runner',
        location: 'Integration',
      },
    });
  }

  function loadOutbox(userId: string): Promise<PersistedOutboxRow[]> {
    return dataSource.query<PersistedOutboxRow[]>(
      `
        SELECT event_name, aggregate_id, deduplication_key, payload
        FROM outbox_messages
        WHERE aggregate_id = $1
        ORDER BY event_name ASC
      `,
      [userId],
    );
  }

  function containsSensitiveValue(value: unknown, sensitiveValues: ReadonlyArray<string>): boolean {
    const serialized = JSON.stringify(value);

    return sensitiveValues.some(sensitiveValue => serialized.includes(sensitiveValue));
  }
});
