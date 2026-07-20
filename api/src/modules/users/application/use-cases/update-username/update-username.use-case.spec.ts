import { UserStatus } from '@/common/models/enums';
import { UserNotFoundError, UsernameAlreadyExistsError } from '@/modules/users/application/errors';
import { UpdateUsernameUseCase } from '@/modules/users/application/use-cases/update-username/update-username.use-case';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Email } from '@/common/domain/value-objects/email.value-object';
import { UserName } from '@/modules/users/domain/value-objects/user-name.value-object';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError } from 'typeorm';

type RunInTransaction = (callback: (manager: EntityManager) => Promise<User>) => Promise<User>;

describe('UpdateUsernameUseCase', () => {
  const userId = '85423f76-b2e0-4499-8b94-da58b1df6f74';
  const manager = {} as EntityManager;

  let moduleRef: TestingModule;
  let useCase: UpdateUsernameUseCase;
  let findByIdForUpdate: jest.MockedFunction<IUserRepository['findByIdForUpdate']>;
  let findByUserName: jest.MockedFunction<IUserRepository['findByUserName']>;
  let save: jest.MockedFunction<IUserRepository['save']>;
  let transaction: jest.MockedFunction<RunInTransaction>;

  beforeEach(async () => {
    findByIdForUpdate = jest.fn();
    findByUserName = jest.fn();
    save = jest.fn().mockImplementation((user: User) => Promise.resolve(user));
    const runInTransaction: RunInTransaction = async callback => callback(manager);
    transaction = jest.fn(runInTransaction);

    moduleRef = await Test.createTestingModule({
      providers: [
        UpdateUsernameUseCase,
        {
          provide: IUserRepository,
          useValue: {
            findByIdForUpdate,
            findByUserName,
            save,
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction,
          },
        },
      ],
    }).compile();

    useCase = moduleRef.get(UpdateUsernameUseCase);
    jest.clearAllMocks();
  });

  it('updates the username inside a transaction', async () => {
    const user = createUser(null, userId);
    findByIdForUpdate.mockResolvedValue(user);
    findByUserName.mockResolvedValue(null);

    const output = await useCase.execute({ userId, newUsername: 'New_UserName' });

    expect(output.userName?.value).toBe('new_username');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(findByIdForUpdate).toHaveBeenCalledWith(userId, { manager });
    expect(findByUserName.mock.calls[0][0].value).toBe('new_username');
    expect(findByUserName.mock.calls[0][1]).toEqual({ manager });
    expect(save).toHaveBeenCalledWith(user, { manager });
  });

  it('does not save when the normalized username is unchanged', async () => {
    const user = createUser('daniel', userId);
    findByIdForUpdate.mockResolvedValue(user);

    const output = await useCase.execute({ userId, newUsername: ' Daniel ' });

    expect(output).toBe(user);
    expect(findByUserName).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects the change when another user already owns the username', async () => {
    findByIdForUpdate.mockResolvedValue(createUser('daniel', userId));
    findByUserName.mockResolvedValue(createUser('maria', 'another-user-id'));

    await expect(useCase.execute({ userId, newUsername: 'maria' })).rejects.toBeInstanceOf(UsernameAlreadyExistsError);

    expect(save).not.toHaveBeenCalled();
  });

  it('maps a database unique violation to UsernameAlreadyExistsError', async () => {
    findByIdForUpdate.mockResolvedValue(createUser(null, userId));
    findByUserName.mockResolvedValue(null);
    save.mockRejectedValue(createUniqueViolation('UQ_user_name'));

    await expect(useCase.execute({ userId, newUsername: 'maria' })).rejects.toBeInstanceOf(UsernameAlreadyExistsError);
  });

  it('rejects the change when the authenticated user no longer exists', async () => {
    findByIdForUpdate.mockResolvedValue(null);

    await expect(useCase.execute({ userId, newUsername: 'daniel' })).rejects.toBeInstanceOf(UserNotFoundError);

    expect(findByUserName).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  function createUser(userName: string | null, id: string): User {
    return User.reconstitute(
      {
        email: Email.reconstitute(`${id}@example.com`),
        userName: userName ? UserName.create(userName) : null,
        firstName: null,
        lastName: null,
        status: UserStatus.ACTIVE,
        avatarAssetId: null,
        authProviders: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      id,
    );
  }

  function createUniqueViolation(constraint: string): QueryFailedError {
    const driverError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint,
    });

    return new QueryFailedError('UPDATE users', [], driverError);
  }
});
