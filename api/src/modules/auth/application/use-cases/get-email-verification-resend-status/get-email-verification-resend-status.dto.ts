import {
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';

export interface GetEmailVerificationResendStatusInput {
  readonly userId: string;
}

export type GetEmailVerificationResendStatusOutput =
  | {
      readonly status: typeof EmailVerificationResendStatus.AVAILABLE;
      readonly available: true;
      readonly manualResendsUsed: number;
      readonly manualResendsRemaining: number;
      readonly lastLogicalSendAt: Date | null;
    }
  | {
      readonly status: typeof EmailVerificationResendStatus.BLOCKED;
      readonly available: false;
      readonly blockedBy: EmailVerificationResendRestriction;
      readonly retryAfterSeconds: number;
      readonly manualResendsUsed: number;
      readonly manualResendsRemaining: number;
      readonly lastLogicalSendAt: Date | null;
    }
  | {
      readonly status: typeof EmailVerificationResendStatus.ALREADY_VERIFIED;
      readonly available: false;
    };
