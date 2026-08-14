import { PasswordChangeEventMetadata } from '@/modules/auth/domain/entities/password-change-event.entity';

export interface ChangeUserPasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Readonly<PasswordChangeEventMetadata>;
}

export interface ChangeUserPasswordOutput {
  status: 'CHANGED';
}
