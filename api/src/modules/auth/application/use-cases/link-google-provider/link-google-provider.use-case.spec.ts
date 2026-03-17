import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LinkGoogleProviderUseCase } from './link-google-provider.use-case';
import { FindUserByIdUseCase } from '../../../../users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { IUserRepository } from '../../../../users/domain/repositories/user.respository.interface';
import { AuthProviderType } from '../../../../../common/models/enums';
import { User } from '../../../../users/domain/entities/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import { UserStatus } from '../../../../../common/models/enums';

describe('LinkGoogleProviderUseCase', () => {
  let useCase: LinkGoogleProviderUseCase;
  let findUserByIdUseCase: FindUserByIdUseCase;
  let userRepository: IUserRepository;
  let dataSource: DataSource;

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
    addAuthProvider: jest.fn(),
  } as unknown as User;

  beforeEach(async () => {
    const mockDataSource = {
      transaction: jest.fn((callback) => callback({ getRepository: jest.fn() })),
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
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('execute', () => {
    it('deve vincular um provider GOOGLE ao usuário autenticado com sucesso', async () => {
      const dto = {
        userId: 'user-id',
        googleId: 'google-123',
      };

      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser);

      await useCase.execute(dto);

      expect(userRepository.findByAuthProvider).toHaveBeenCalledWith(
        AuthProviderType.GOOGLE,
        'google-123',
        expect.any(Object),
      );
      expect(findUserByIdUseCase.execute).toHaveBeenCalledWith('user-id', expect.any(Object));
      expect(mockUser.addAuthProvider).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalledWith(mockUser, expect.any(Object));
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

      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(sameUser);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser);

      await useCase.execute(dto);

      expect(userRepository.findByAuthProvider).toHaveBeenCalledWith(
        AuthProviderType.GOOGLE,
        'google-123',
        expect.any(Object),
      );
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
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(null as any);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('User not found');
    });
  });
});
