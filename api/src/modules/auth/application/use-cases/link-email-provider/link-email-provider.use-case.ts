import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { AuthProviderType } from '@/common/models/enums';
import { IHashService } from '@/common/models/interfaces';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { FindUserByIdUseCase } from '@/modules/users/application/use-cases/find-user-by-id/find-user-by-id.use-case';
import { type LinkEmailProviderUseCaseDto } from './link-email-provider.dto';
import { HashedPassword } from '@/modules/users/domain/value-objects/hashed-password.value-object';

@Injectable()
export class LinkEmailProviderUseCase {
  constructor(
    private readonly findUserByIdUseCase: FindUserByIdUseCase,
    private readonly userRepository: IUserRepository,
    private readonly hashService: IHashService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async execute(data: LinkEmailProviderUseCaseDto): Promise<void> {
    const passwordHash = await this.hashService.hash(data.password);

    await this.dataSource.transaction(async manager => {
      // Verifica se já existe um provider EMAIL vinculado a outro usuário com este email
      const existingEmailProvider = await this.userRepository.findByAuthProvider(AuthProviderType.EMAIL, data.email, {
        manager,
      });

      if (existingEmailProvider) {
        throw new ConflictException('Email already registered');
      }

      // Busca o usuário atual
      const user = await this.findUserByIdUseCase.execute(data.userId, { manager });

      if (!user) {
        throw new ConflictException('User not found');
      }

      // Verifica se o usuário já possui um provider EMAIL
      const hasEmailProvider = user.authProviders.some(provider => provider.provider === AuthProviderType.EMAIL);

      if (hasEmailProvider) {
        throw new ConflictException('User already has an email provider');
      }

      // Adiciona o novo provider EMAIL ao usuário
      user.addAuthProvider(
        randomUUID(),
        AuthProviderType.EMAIL,
        data.email,
        HashedPassword.createFromHash(passwordHash),
      );

      // Salva o usuário com o novo provider
      await this.userRepository.save(user, { manager });
    });
  }
}
