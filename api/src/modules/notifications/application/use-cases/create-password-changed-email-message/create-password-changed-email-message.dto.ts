import { PasswordChangeSecurityContext } from '@/modules/auth/domain/events/password-change-security-context';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';

export interface CreatePasswordChangedEmailMessageUseCaseInput {
  userId: string;
  sourceEventId: string;
  occurredAt: Date;
  securityContext: PasswordChangeSecurityContext;
}

export interface CreatePasswordChangedEmailMessageUseCaseOutput {
  emailMessage: EmailMessage;
  created: boolean;
  shouldEnqueue: boolean;
}
