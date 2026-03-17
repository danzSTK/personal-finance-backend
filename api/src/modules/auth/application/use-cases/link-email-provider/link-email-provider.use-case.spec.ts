import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LinkEmailProviderUseCase } from './link-email-provider.use-case';
import { FindUserByIdUseCase } from '../../../../users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { IUserRepository } from '../../../../users/domain/repositories/user.respository.interface';
import { IHashService } from '../../../../../common/models/interfaces';
import { AuthProviderType } from '../../../../../common/models/enums';
import { User } from '../../../../users/domain/entities/user.entity';
import { Email } from '../../../../users/domain/value-objects/email.value-object';
import { UserStatus } from '../../../../../common/models/enums';

describe('LinkEmailProviderUseCase', () => {
  let useCase: LinkEmailProviderUseCase;
  let findUserByIdUseCase: FindUserByIdUseCase;
  let userRepository: IUserRepository;
  let hashService: IHashService;
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
    dataSource = module.get<DataSource>(DataSource);
  });

  describe('execute', () => {
    it('deve vincular um provider EMAIL ao usuário autenticado com sucesso', async () => {
      const dto = {
        userId: 'user-id',
        email: 'newemail@example.com',
        password: 'password123',
        sessionMetadata: {} as any,
      };

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password' as any);
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(mockUser);
      jest.spyOn(userRepository, 'save').mockResolvedValue(mockUser);

      await useCase.execute(dto);

      expect(hashService.hash).toHaveBeenCalledWith('password123');
      expect(userRepository.findByAuthProvider).toHaveBeenCalledWith(
        AuthProviderType.EMAIL,
        'newemail@example.com',
        expect.any(Object),
      );
      expect(findUserByIdUseCase.execute).toHaveBeenCalledWith('user-id', expect.any(Object));
      expect(mockUser.addAuthProvider).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalledWith(mockUser, expect.any(Object));
    });

    it('deve lançar ConflictException se o email já estiver registrado', async () => {
      const dto = {
        userId: 'user-id',
        email: 'existing@example.com',
        password: 'password123',
        sessionMetadata: {} as any,
      };

      const existingUser = { ...mockUser, id: 'other-user-id' } as User;

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password' as any);
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(existingUser);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('Email already registered');
    });

    it('deve lançar ConflictException se o usuário já possui provider EMAIL', async () => {
      const dto = {
        userId: 'user-id',
        email: 'newemail@example.com',
        password: 'password123',
        sessionMetadata: {} as any,
      };

      const userWithEmailProvider = {
        ...mockUser,
        authProviders: [{ provider: AuthProviderType.EMAIL }],
      } as unknown as User;

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password' as any);
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(userWithEmailProvider);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('User already has an email provider');
    });

    it('deve lançar ConflictException se o usuário não for encontrado', async () => {
      const dto = {
        userId: 'non-existent-user',
        email: 'newemail@example.com',
        password: 'password123',
        sessionMetadata: {} as any,
      };

      jest.spyOn(hashService, 'hash').mockResolvedValue('hashed-password' as any);
      jest.spyOn(userRepository, 'findByAuthProvider').mockResolvedValue(null);
      jest.spyOn(findUserByIdUseCase, 'execute').mockResolvedValue(null as any);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      await expect(useCase.execute(dto)).rejects.toThrow('User not found');
    });
  });
});
