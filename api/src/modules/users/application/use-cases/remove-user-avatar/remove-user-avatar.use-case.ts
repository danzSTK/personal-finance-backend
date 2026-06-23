import { UserNotFoundError } from '@/modules/users/application/errors';
import { IUserCacheInvalidator } from '@/modules/users/application/ports/user-cache-invalidator.interface';
import { RemoveUserAvatarInput } from '@/modules/users/application/use-cases/remove-user-avatar/remove-user-avatar.dto';
import { User } from '@/modules/users/domain/entities/user.entity';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { OutboxWriteService } from '@/shared/outbox/services/outbox-write.service';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface RemoveAvatarTransactionResult {
  user: User;
  removed: boolean;
}

@Injectable()
export class RemoveUserAvatarUseCase {
  private readonly logger = new Logger(RemoveUserAvatarUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly userRepository: IUserRepository,
    private readonly outboxWriter: OutboxWriteService,
    private readonly userCacheInvalidator: IUserCacheInvalidator,
  ) {}

  async execute(input: RemoveUserAvatarInput): Promise<void> {
    const result = await this.dataSource.transaction<RemoveAvatarTransactionResult>(async manager => {
      const user = await this.userRepository.findByIdForUpdate(input.userId, { manager });

      if (!user) {
        throw new UserNotFoundError();
      }

      const previousAssetId = user.removeAvatarAsset();

      if (!previousAssetId) {
        return { user, removed: false };
      }

      const savedUser = await this.userRepository.save(user, { manager });
      await this.outboxWriter.storeEvents(user.pullDomainEvents(), { manager });

      return { user: savedUser, removed: true };
    });

    if (!result.removed) {
      return;
    }

    try {
      await this.userCacheInvalidator.invalidate(result.user);
    } catch (error) {
      this.logger.error(
        `Avatar removed but user cache invalidation failed userId=${input.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
