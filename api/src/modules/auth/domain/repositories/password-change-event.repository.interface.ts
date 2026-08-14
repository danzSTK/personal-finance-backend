import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { PasswordChangeEvent } from '@/modules/auth/domain/entities/password-change-event.entity';

export abstract class IPasswordChangeEventRepository {
  abstract findRelevantEvents(
    userId: string,
    since: Date,
    options?: IRepositoryOptions,
  ): Promise<PasswordChangeEvent[]>;

  abstract findActiveBlock(userId: string, at: Date, options?: IRepositoryOptions): Promise<PasswordChangeEvent | null>;

  abstract save(event: PasswordChangeEvent, options?: IRepositoryOptions): Promise<PasswordChangeEvent>;

  abstract saveAll(events: PasswordChangeEvent[], options?: IRepositoryOptions): Promise<PasswordChangeEvent[]>;
}
