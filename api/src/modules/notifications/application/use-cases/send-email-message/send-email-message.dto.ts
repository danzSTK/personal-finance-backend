import { EmailMessageStatus } from '@/modules/notifications/domain/constants/email-message.constants';

export interface SendEmailMessageUseCaseInput {
  emailMessageId: string;
  now?: Date;
}

export interface SendEmailMessageUseCaseOutput {
  status: EmailMessageStatus;
  sent: boolean;
  unrecoverable: boolean;
}
