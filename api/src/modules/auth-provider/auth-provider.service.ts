import { Injectable } from '@nestjs/common';
import { AuthProvider } from '../auth/entities/auth-provider.entity';
import { AuthProviderType } from '../../common/models/enums/auth-provider.enum';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CreateAuthProviderDto } from './dto/create-auth-provider.dto';

import { UsersService } from '../users/users.service';
@Injectable()
export class AuthProviderService {
  constructor(
    @InjectRepository(AuthProvider)
    private readonly authProviderRepository: Repository<AuthProvider>,
    private readonly userService: UsersService,

    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByUserAndProvider(userId: string, provider: AuthProviderType) {
    // Implementation to find auth provider by user ID and provider type
    return this.authProviderRepository.findOne({
      where: {
        user_id: userId,
        provider,
      },
    });
  }

  /**
   * 🔍 Busca por provider + providerUserId (a constraint única)
   * Ex: (EMAIL, "teste@gmail.com") ou (GOOGLE, "123456789")
   */
  async findByProviderAndProviderId(
    provider: AuthProviderType,
    providerId: string,
    manager?: EntityManager,
  ): Promise<AuthProvider | null> {
    const repository = manager ? manager.getRepository(AuthProvider) : this.authProviderRepository;

    return repository.findOne({
      where: {
        provider,
        providerUserId: providerId,
      },
    });
  }

  /**
   *
   * @param userId
   * @returns Todos os AuthProviders associados a um usuário
   */

  async findAllByUserID(userId: string): Promise<AuthProvider[]> {
    return this.authProviderRepository.find({
      where: {
        user_id: userId,
      },
    });
  }

  /**
   *
   * @returns Todos os AuthProviders cadastrados no sistema
   */
  async getAuthProviders() {
    return this.authProviderRepository.find();
  }

  /**
   *
   * @param data
   * @param manager
   * @returns Cria um novo AuthProvider
   */
  async createAuthProvider(data: CreateAuthProviderDto, manager?: EntityManager): Promise<AuthProvider> {
    const repository = manager ? manager.getRepository(AuthProvider) : this.authProviderRepository;

    const newAuthProviderPayload: CreateAuthProviderDto = {
      ...data,
    };

    if (data.provider === AuthProviderType.EMAIL) {
      newAuthProviderPayload.providerUserId = data.providerUserId.trim().toLowerCase();
    }

    const authProvider = repository.create(newAuthProviderPayload);

    return repository.save(authProvider);
  }
}
