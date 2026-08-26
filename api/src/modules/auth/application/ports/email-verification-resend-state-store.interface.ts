import {
  EmailVerificationResendRestriction,
  EmailVerificationResendMutationKind,
  EmailVerificationResendStatus,
  NewEmailVerificationChallengeOrigin,
} from '@/modules/auth/domain/constants/email-verification.constants';

export interface EmailVerificationResendStateBase {
  readonly manualResendsUsed: number;
  readonly manualResendsRemaining: number;
  readonly lastLogicalSendAt: Date | null;
}

export type EmailVerificationResendState =
  | (EmailVerificationResendStateBase & {
      readonly kind: typeof EmailVerificationResendStatus.AVAILABLE;
    })
  | (EmailVerificationResendStateBase & {
      readonly kind: typeof EmailVerificationResendStatus.BLOCKED;
      readonly blockedBy: EmailVerificationResendRestriction;
      readonly retryAfterSeconds: number;
    });

export type BeginEmailVerificationResendMutationResult =
  | {
      readonly kind: typeof EmailVerificationResendMutationKind.ACQUIRED;
      readonly manualResendsUsed: number;
    }
  | {
      readonly kind: typeof EmailVerificationResendMutationKind.BLOCKED;
      readonly blockedBy: EmailVerificationResendRestriction;
      readonly retryAfterSeconds: number;
      readonly manualResendsUsed: number;
    };

export interface CompleteEmailVerificationLogicalSendInput {
  readonly userId: string;
  readonly origin: NewEmailVerificationChallengeOrigin;
  readonly challengeId: string;
  readonly logicalSendAt: Date;
  readonly now: Date;
  readonly mutationToken?: string;
}

export abstract class IEmailVerificationResendStateStore {
  /**
   * Reads the current resend availability without consuming a manual resend or
   * acquiring the mutation barrier. Expired window entries may be pruned as
   * part of the atomic read.
   */
  abstract load(userId: string, now: Date): Promise<EmailVerificationResendState>;

  /**
   * Atomically evaluates cooldown, daily limit and concurrent mutation state.
   * When available, acquires the short-lived barrier identified by
   * `mutationToken`; it does not increment counters or start a cooldown.
   */
  abstract beginMutation(
    userId: string,
    mutationToken: string,
    now: Date,
  ): Promise<BeginEmailVerificationResendMutationResult>;

  /**
   * Extends the short-lived mutation barrier only while `mutationToken` remains
   * its owner. A missing barrier or ownership change is a technical failure and
   * must prevent the surrounding SQL transaction from committing.
   */
  abstract renewMutation(userId: string, mutationToken: string): Promise<void>;

  /**
   * Records a SQL-confirmed logical send idempotently, updates the last-send
   * snapshot and cooldown, counts manual origins in the 24-hour window and
   * releases the caller's mutation barrier when a token is provided.
   */
  abstract completeLogicalSend(input: CompleteEmailVerificationLogicalSendInput): Promise<void>;

  /**
   * Releases a mutation barrier after the SQL operation fails, but only when
   * its stored value still belongs to `mutationToken`.
   */
  abstract abortMutation(userId: string, mutationToken: string): Promise<void>;
}
