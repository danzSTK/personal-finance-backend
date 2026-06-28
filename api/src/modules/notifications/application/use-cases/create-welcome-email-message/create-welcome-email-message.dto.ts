import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';

export interface CreateWelcomeEmailMessageUseCaseInput {
  userId: string;
  email: string;
}

export interface CreateWelcomeEmailMessageUseCaseOutput {
  emailMessage: EmailMessage;
  created: boolean;
  shouldEnqueue: boolean;
}
