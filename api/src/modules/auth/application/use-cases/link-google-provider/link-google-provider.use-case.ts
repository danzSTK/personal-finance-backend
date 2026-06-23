import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuthProviderType } from '@/common/models/enums';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { type LinkGoogleProviderUseCaseDto } from './link-google-provider.dto';
import {
  AuthProviderAlreadyLinkedError,
  AuthProviderLinkedToAnotherUserError,
} from '@/modules/auth/application/errors';
import { UserNotFoundError } from '@/modules/users/application/errors';

@Injectable()
export class LinkGoogleProviderUseCase {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly userRepository: IUserRepository,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: LinkGoogleProviderUseCaseDto): Promise<void> {
    await this.dataSource.transaction(async manager => {
      // Verifica se o googleId já está vinculado a outro usuário
      const existingGoogleProvider = await this.userRepository.findByAuthProvider(
        AuthProviderType.GOOGLE,
        data.googleId,
        { manager },
      );

      if (existingGoogleProvider && existingGoogleProvider.id !== data.userId) {
        throw new AuthProviderLinkedToAnotherUserError(AuthProviderType.GOOGLE);
      }

      // Busca o usuário atual
      const user = await this.findUserByIdUseCase.execute(data.userId, { manager });

      if (!user) {
        throw new UserNotFoundError();
      }

      // Verifica se o usuário já possui um provider GOOGLE
      const hasGoogleProvider = user.authProviders.some(provider => provider.provider === AuthProviderType.GOOGLE);

      if (hasGoogleProvider) {
        throw new AuthProviderAlreadyLinkedError(AuthProviderType.GOOGLE);
      }

      // Adiciona o novo provider GOOGLE ao usuário
      user.addAuthProvider(randomUUID(), AuthProviderType.GOOGLE, data.googleId, null);

      // Salva o usuário com o novo provider
      await this.userRepository.save(user, { manager });
    });
  }
}
