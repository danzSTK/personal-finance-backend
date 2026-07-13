import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';

export interface ReenqueuableEmailMessage {
  id: string;
}

export abstract class IEmailMessageRepository {
  abstract findById(id: string, options?: IRepositoryOptions): Promise<EmailMessage | null>;
  abstract findByIdForUpdate(id: string, options: Required<IRepositoryOptions>): Promise<EmailMessage | null>;
  abstract findByIdempotencyKey(idempotencyKey: string, options?: IRepositoryOptions): Promise<EmailMessage | null>;
  abstract findReenqueuableBefore(cutoff: Date, limit: number): Promise<ReenqueuableEmailMessage[]>;
  abstract save(emailMessage: EmailMessage, options?: IRepositoryOptions): Promise<EmailMessage>;
}
