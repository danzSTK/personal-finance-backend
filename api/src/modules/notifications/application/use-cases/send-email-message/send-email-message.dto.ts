import { EmailMessageStatus } from '@/modules/notifications/domain/constants/email-message.constants';

export interface SendEmailMessageUseCaseInput {
  emailMessageId: string;
}

export interface SendEmailMessageUseCaseOutput {
  status: EmailMessageStatus;
  sent: boolean;
}
