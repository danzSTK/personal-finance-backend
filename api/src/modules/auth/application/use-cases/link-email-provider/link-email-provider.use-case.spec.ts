import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { LinkEmailProviderUseCase } from './link-email-provider.use-case';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { IHashService, SessionMetadata } from '@/common/models/interfaces';
import { AuthProviderType } from '@/common/models/enums';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';
import { AuthProviderAlreadyLinkedError } from '@/modules/auth/application/errors';
import { UserEmailAlreadyExistsError, UserNotFoundError } from '@/modules/users/application/errors';

describe('LinkEmailProviderUseCase', () => {
  let useCase: LinkEmailProviderUseCase;
  let findUserByIdUseCase: FindUserByIdUseCase;
  let userRepository: IUserRepository;
  let hashService: IHashService;

  const defaultSessionMetadata: SessionMetadata = {
    browser: 'Chrome',
    os: 'Linux',
    device: 'Desktop',
    ip: '127.0.0.1',
    location: 'Local',
    loginAt: new Date().toISOString(),
  };
  const addAuthProviderMock = jest.fn();

  const mockUser = {
    id: 'user-id',
    email: Email.create('user@example.com'),
    status: UserStatus.ACTIVE,
    firstName: 'Test',
    lastName: 'User',
    userName: null,
    authProviders: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    addAuthProvider: addAuthProviderMock,
  } as unknown as User;

  beforeEach(async () => {
    const mockDataSource = {
      transaction: jest.fn(
        async (callback: (manager: EntityManager) => Promise<unknown>): Promise<unknown> =>
          callback({} as EntityManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkEmailProviderUseCase,
        {
          provide: FindUserByIdUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },

        {
          provide: IUserRepository,
          useValue: {
            findByAuthProvider: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: IHashService,
          useValue: {
            hash: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    useCase = module.get<LinkEmailProviderUseCase>(LinkEmailProviderUseCase);
    findUserByIdUseCase = module.get<FindUserByIdUseCase>(FindUserByIdUseCase);
    userRepository = module.get<IUserRepository>(IUserRepository);
    hashService = module.get<IHashService>(IHashService);
  });

  describe('execute', () => {
    it('deve vincular um provider EMAIL ao usuário autenticado com sucesso', async () => {
      const dto = {
        userId: 'user-id',
        email: 'newemail@example.com',
        password: 'password123',
        sessionMetadata: defaultSessionMetadata,
      };

      const hashSpy = jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password');
      const findByAuthProviderSpy = jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      const findUserByIdSpy = jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(mockUser);
      const saveSpy = jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser);

      await useCase.execute(dto);

      expect(hashSpy).toHaveBeenCalledWith('password123');
      expect(findByAuthProviderSpy).toHaveBeenCalledWith(
        AuthProviderType.EMAIL,
        'newemail@example.com',
        expect.any(Object),
      );
      expect(findUserByIdSpy).toHaveBeenCalledWith('user-id', expect.any(Object));
      expect(addAuthProviderMock).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledWith(mockUser, expect.any(Object));
    });

    it('deve lançar UserEmailAlreadyExistsError se o email já estiver registrado', async () => {
      const dto = {
        userId: 'user-id',
        email: 'existing@example.com',
        password: 'password123',
        sessionMetadata: defaultSessionMetadata,
      };

      const existingUser = { ...mockUser, id: 'other-user-id' } as User;

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(existingUser);

      await expect(useCase.execute(dto)).rejects.toThrow(UserEmailAlreadyExistsError);
      await expect(useCase.execute(dto)).rejects.toThrow('User with email "existing@example.com" already exists.');
    });

    it('deve lançar AuthProviderAlreadyLinkedError se o usuário já possui provider EMAIL', async () => {
      const dto = {
        userId: 'user-id',
        email: 'newemail@example.com',
        password: 'password123',
        sessionMetadata: defaultSessionMetadata,
      };

      const userWithEmailProvider = {
        ...mockUser,
        authProviders: [{ provider: AuthProviderType.EMAIL }],
      } as unknown as User;

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(userWithEmailProvider);

      await expect(useCase.execute(dto)).rejects.toThrow(AuthProviderAlreadyLinkedError);
      await expect(useCase.execute(dto)).rejects.toThrow('User already has a EMAIL provider.');
    });

    it('deve lançar UserNotFoundError se o usuário não for encontrado', async () => {
      const dto = {
        userId: 'non-existent-user',
        email: 'newemail@example.com',
        password: 'password123',
        sessionMetadata: defaultSessionMetadata,
      };

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password');
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(null as unknown as User);

      await expect(useCase.execute(dto)).rejects.toThrow(UserNotFoundError);
      await expect(useCase.execute(dto)).rejects.toThrow('User not found.');
    });
  });
});
