/* eslint-disable @typescript-eslint/unbound-method */
import { Email } from '@/common/domain/value-objects/email.value-object';
import { AuthProviderType, UserStatus } from '@/common/models/enums';
import { IHashService } from '@/common/models/interfaces';
import {
  AuthProviderAlreadyLinkedError,
  AuthProviderLinkedToAnotherUserError,
} from '@/modules/auth/application/errors';
import { UserNotFoundError } from '@/modules/users/application/errors';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { LinkEmailProviderUseCase } from './link-email-provider.use-case';

describe('LinkEmailProviderUseCase', () => {
  let useCase: LinkEmailProviderUseCase;
  let userRepository: jest.Mocked<IUserRepository>;
  let hashService: jest.Mocked<IHashService>;
  let manager: EntityManager;

  const createUser = (email = 'principal@example.com'): User =>
    User.reconstitute(
      {
        userName: null,
        firstName: 'Test',
        lastName: 'User',
        email: Email.create(email),
        status: UserStatus.PENDING_PROFILE,
        avatarAssetId: null,
        authProviders: [],
        createdAt: new Date('2026-08-28T12:00:00.000Z'),
        updatedAt: new Date('2026-08-28T12:00:00.000Z'),
      },
      randomUUID(),
    );

  beforeEach(async () => {
    manager = {} as EntityManager;
    const repositoryMock = {
      findById: jest.fn(),
      findByIdForUpdate: jest.fn(),
      findCredentialVersionById: jest.fn(),
      findByEmail: jest.fn(),
      findByUserName: jest.fn(),
      findByAuthProvider: jest.fn(),
      usernameAlreadyExists: jest.fn(),
      save: jest.fn(),
    } as jest.Mocked<IUserRepository>;
    const hashServiceMock = {
      hash: jest.fn().mockResolvedValue('hashed-password'),
      compare: jest.fn(),
    } as jest.Mocked<IHashService>;
    const dataSource = {
      transaction: jest.fn(async (callback: (transactionManager: EntityManager) => Promise<void>) => callback(manager)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkEmailProviderUseCase,
        { provide: IUserRepository, useValue: repositoryMock },
        { provide: IHashService, useValue: hashServiceMock },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    useCase = module.get(LinkEmailProviderUseCase);
    userRepository = module.get(IUserRepository);
    hashService = module.get(IHashService);
    jest.clearAllMocks();
    hashService.hash.mockResolvedValue('hashed-password');
  });

  describe('execute', () => {
    it('links EMAIL using only the persisted primary email', async () => {
      const user = createUser();
      const addAuthProvider = jest.spyOn(user, 'addAuthProvider');
      userRepository.findByIdForUpdate.mockResolvedValue(user);
      userRepository.findByAuthProvider.mockResolvedValue(null);
      userRepository.save.mockResolvedValue(user);

      await useCase.execute({ userId: user.id, password: 'password123' });

      expect(hashService.hash).toHaveBeenCalledWith('password123');
      expect(userRepository.findByIdForUpdate).toHaveBeenCalledWith(user.id, { manager });
      expect(userRepository.findByAuthProvider).toHaveBeenCalledWith(AuthProviderType.EMAIL, 'principal@example.com', {
        manager,
      });
      expect(addAuthProvider).toHaveBeenCalledWith(
        expect.any(String),
        AuthProviderType.EMAIL,
        'principal@example.com',
        expect.any(HashedPassword),
      );
      expect(userRepository.save).toHaveBeenCalledWith(user, { manager });
      expect(user.email.value).toBe('principal@example.com');
      expect(user.status).toBe(UserStatus.PENDING_PROFILE);
    });

    it('rejects a user that already has an EMAIL provider without replacing its password', async () => {
      const user = createUser();
      user.addAuthProvider(
        randomUUID(),
        AuthProviderType.EMAIL,
        user.email.value,
        HashedPassword.createFromHash('existing-hash'),
      );
      userRepository.findByIdForUpdate.mockResolvedValue(user);

      await expect(useCase.execute({ userId: user.id, password: 'password123' })).rejects.toBeInstanceOf(
        AuthProviderAlreadyLinkedError,
      );

      expect(userRepository.findByAuthProvider).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
      expect(user.getCredentialsAuthProvider()?.passwordHash.value).toBe('existing-hash');
    });

    it('rejects when the canonical email provider belongs to another user', async () => {
      const user = createUser();
      userRepository.findByIdForUpdate.mockResolvedValue(user);
      userRepository.findByAuthProvider.mockResolvedValue(createUser('other@example.com'));

      await expect(useCase.execute({ userId: user.id, password: 'password123' })).rejects.toBeInstanceOf(
        AuthProviderLinkedToAnotherUserError,
      );

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when the authenticated user no longer exists', async () => {
      userRepository.findByIdForUpdate.mockResolvedValue(null);

      await expect(useCase.execute({ userId: randomUUID(), password: 'password123' })).rejects.toBeInstanceOf(
        UserNotFoundError,
      );

      expect(userRepository.findByAuthProvider).not.toHaveBeenCalled();
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('translates the known provider uniqueness race to a stable conflict', async () => {
      const user = createUser();
      const driverError = Object.assign(new Error('duplicate'), {
        code: '23505',
        constraint: 'UQ_auth_providers',
      });
      userRepository.findByIdForUpdate.mockResolvedValue(user);
      userRepository.findByAuthProvider.mockResolvedValue(null);
      userRepository.save.mockRejectedValue(new QueryFailedError('INSERT', [], driverError));

      await expect(useCase.execute({ userId: user.id, password: 'password123' })).rejects.toBeInstanceOf(
        AuthProviderLinkedToAnotherUserError,
      );
    });

    it('does not hide an unknown persistence failure', async () => {
      const user = createUser();
      const failure = new Error('storage unavailable');
      userRepository.findByIdForUpdate.mockResolvedValue(user);
      userRepository.findByAuthProvider.mockResolvedValue(null);
      userRepository.save.mockRejectedValue(failure);

      await expect(useCase.execute({ userId: user.id, password: 'password123' })).rejects.toBe(failure);
    });
  });
});
