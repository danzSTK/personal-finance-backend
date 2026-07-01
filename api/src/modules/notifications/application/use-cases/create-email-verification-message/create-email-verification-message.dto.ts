import { IRepositoryOptions } from '@/common/models/interfaces/repository-options.interface';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';

export interface CreateEmailVerificationMessageUseCaseInput {
  userId: string;
  challengeId: string;
  email: string;
  token: string | null;
  options?: IRepositoryOptions;
}

export interface CreateEmailVerificationMessageUseCaseOutput {
  emailMessage: EmailMessage | null;
  created: boolean;
  shouldEnqueue: boolean;
}
