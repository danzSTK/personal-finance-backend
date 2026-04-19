import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { LinkGoogleProviderUseCase } from './link-google-provider.use-case';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { AuthProviderType } from '@/common/models/enums';
import { User } from '@/modules/users/domain/entities/user.entity';
import { Email } from '@/modules/users/domain/value-objects/email.value-object';
import { UserStatus } from '@/common/models/enums';

describe('LinkGoogleProviderUseCase', () => {
  let useCase: LinkGoogleProviderUseCase;
  let findUserByIdUseCase: FindUserByIdUseCase;
  let userRepository: IUserRepository;
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
        LinkGoogleProviderUseCase,
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
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    useCase = module.get<LinkGoogleProviderUseCase>(LinkGoogleProviderUseCase);
    findUserByIdUseCase = module.get<FindUserByIdUseCase>(FindUserByIdUseCase);
    userRepository = module.get<IUserRepository>(IUserRepository);
  });

  describe('execute', () => {
    it('deve vincular um provider GOOGLE ao usuário autenticado com sucesso', async () => {
      const dto = {
        userId: 'user-id',
        googleId: 'google-123',
      };

      const findByAuthProviderSpy = jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      const findUserByIdSpy = jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(mockUser);
      const saveSpy = jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser);

      await useCase.execute(dto);

      expect(findByAuthProviderSpy).toHaveBeenCalledWith(AuthProviderType.GOOGLE, 'google-123', expect.any(Object));
      expect(findUserByIdSpy).toHaveBeenCalledWith('user-id', expect.any(Object));
      expect(addAuthProviderMock).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalledWith(mockUser, expect.any(Object));
    });

    it('deve lançar ConflictException se o googleId já estiver vinculado a outro usuário', async () => {
      const dto = {
        userId: 'user-id',
        googleId: 'google-123',
      };

      const existingUser = { ...mockUser, id: 'other-user-id' } as User;

      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(existingUser);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('Google account already linked to another user');
    });

    it('deve permitir vincular se o googleId já pertence ao mesmo usuário', async () => {
      const dto = {
        userId: 'user-id',
        googleId: 'google-123',
      };

      const sameUser = { ...mockUser, id: 'user-id' } as User;

      const findByAuthProviderSpy = jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(sameUser);
      const findUserByIdSpy = jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(mockUser);
      const saveSpy = jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser);

      await useCase.execute(dto);

      expect(findByAuthProviderSpy).toHaveBeenCalledWith(AuthProviderType.GOOGLE, 'google-123', expect.any(Object));
      expect(findUserByIdSpy).toHaveBeenCalledWith('user-id', expect.any(Object));
      expect(saveSpy).toHaveBeenCalledWith(mockUser, expect.any(Object));
    });

    it('deve lançar ConflictException se o usuário já possui provider GOOGLE', async () => {
      const dto = {
        userId: 'user-id',
        googleId: 'google-123',
      };

      const userWithGoogleProvider = {
        ...mockUser,
        authProviders: [{ provider: AuthProviderType.GOOGLE }],
      } as unknown as User;

      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(userWithGoogleProvider);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('User already has a Google provider');
    });

    it('deve lançar ConflictException se o usuário não for encontrado', async () => {
      const dto = {
        userId: 'non-existent-user',
        googleId: 'google-123',
      };

      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(null as unknown as User);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('User not found');
    });
  });
});
