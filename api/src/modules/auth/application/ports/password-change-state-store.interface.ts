import { PasswordChangeState } from '@/modules/auth/domain/policies/change-password.policy';

export interface PasswordChangeProjectionEntry {
  readonly eventId: string;
  readonly occurredAt: Date;
}

export interface PasswordChangeStateProjection {
  readonly failedAttempts: ReadonlyArray<PasswordChangeProjectionEntry>;
  readonly completedChanges: ReadonlyArray<PasswordChangeProjectionEntry>;
  readonly blockedUntil: Date | null;
  readonly lastBlockStartedAt: Date | null;
}

export enum PasswordChangeStateLoadResultKind {
  READY = 'READY',
  MISSING = 'MISSING',
  PENDING = 'PENDING',
}

export type PasswordChangeStateLoadResult =
  | {
      readonly kind: PasswordChangeStateLoadResultKind.READY;
      readonly state: PasswordChangeState;
    }
  | {
      readonly kind: PasswordChangeStateLoadResultKind.MISSING;
    }
  | {
      readonly kind: PasswordChangeStateLoadResultKind.PENDING;
      readonly retryAfterSeconds: number;
    };

export type PasswordChangeMutationStartResult =
  | {
      readonly acquired: true;
    }
  | {
      readonly acquired: false;
      readonly retryAfterSeconds: number;
    };

export abstract class IPasswordChangeStateStore {
  /**
   * MISSING nunca deve ser interpretado como autorização.
   */
  abstract load(userId: string, now: Date): Promise<PasswordChangeStateLoadResult>;

  /**
   * Cria uma barreira curta e invalida o marcador initialized.
   * O token permite que somente o dono finalize a mutação.
   */
  abstract beginMutation(
    userId: string,
    mutationToken: string,
    ttlMs: number,
  ): Promise<PasswordChangeMutationStartResult>;

  /**
   * Substitui atomicamente a projeção do usuário por uma visão reconstruída
   * do PostgreSQL, recria initialized e remove pending se o token for o dono.
   */

  abstract replace(
    userId: string,
    projection: PasswordChangeStateProjection,
    now: Date,
    mutationToken?: string,
  ): Promise<void>;

  abstract clear(userId: string): Promise<void>;
}
