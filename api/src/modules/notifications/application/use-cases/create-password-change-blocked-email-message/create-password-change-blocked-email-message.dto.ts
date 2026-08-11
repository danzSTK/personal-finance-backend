import { PasswordChangeSecurityContext } from '@/modules/auth/domain/events/password-change-security-context';
import { EmailMessage } from '@/modules/notifications/domain/entities/email-message.entity';

export interface CreatePasswordChangeBlockedEmailMessageUseCaseInput {
  userId: string;
  sourceEventId: string;
  blockedUntil: Date;
  securityContext: PasswordChangeSecurityContext;
}

export interface CreatePasswordChangeBlockedEmailMessageUseCaseOutput {
  emailMessage: EmailMessage;
  created: boolean;
  shouldEnqueue: boolean;
}
