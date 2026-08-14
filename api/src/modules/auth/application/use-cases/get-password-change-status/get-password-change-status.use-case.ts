import { PasswordChangeOperationPendingError } from '@/modules/auth/application/errors/password-change-operation-pending.error';
import { PasswordChangeStateLoader } from '@/modules/auth/application/services/password-change-state-loader';
import {
  GetPasswordChangeStatusInput,
  GetPasswordChangeStatusOutput,
} from '@/modules/auth/application/use-cases/get-password-change-status/get-password-change-status.dto';
import { ChangePasswordPolicy } from '@/modules/auth/domain/policies/change-password.policy';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GetPasswordChangeStatusUseCase {
  constructor(
    private readonly stateLoader: PasswordChangeStateLoader,
    private readonly policy: ChangePasswordPolicy,
  ) {}

  async execute(input: GetPasswordChangeStatusInput): Promise<GetPasswordChangeStatusOutput> {
    const now = new Date();

    try {
      const operationalState = await this.stateLoader.load(input.userId, now);
      const restriction = this.policy.evaluateRestrictions(operationalState.state, now);

      if (restriction.allowed) {
        return { status: true };
      }

      return {
        status: false,
        retryAfterSeconds: restriction.retryAfterSeconds,
      };
    } catch (error) {
      if (error instanceof PasswordChangeOperationPendingError) {
        return {
          status: false,
          retryAfterSeconds: error.retryAfterSeconds,
        };
      }

      throw error;
    }
  }
}
