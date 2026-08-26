import { UserStatus } from '@/common/models/enums';
import {
  EmailVerificationRequiredError,
  EmailVerificationStateUnavailableError,
} from '@/modules/auth/application/errors';
import { IEmailVerificationResendStateStore } from '@/modules/auth/application/ports/email-verification-resend-state-store.interface';
import {
  GetEmailVerificationResendStatusInput,
  GetEmailVerificationResendStatusOutput,
} from '@/modules/auth/application/use-cases/get-email-verification-resend-status/get-email-verification-resend-status.dto';
import { IUserRepository } from '@/modules/users/domain/repositories/user.respository.interface';
import { Injectable } from '@nestjs/common';
import { EmailVerificationResendStatus } from '@/modules/auth/domain/constants/email-verification.constants';

@Injectable()
export class GetEmailVerificationResendStatusUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly resendStateStore: IEmailVerificationResendStateStore,
  ) {}

  async execute(input: GetEmailVerificationResendStatusInput): Promise<GetEmailVerificationResendStatusOutput> {
    const user = await this.userRepository.findById(input.userId);

    if (!user) {
      throw new EmailVerificationRequiredError();
    }

    if (user.status === UserStatus.ACTIVE) {
      return { status: EmailVerificationResendStatus.ALREADY_VERIFIED, available: false };
    }

    if (user.status !== UserStatus.PENDING_EMAIL_VERIFICATION) {
      throw new EmailVerificationRequiredError();
    }

    try {
      const state = await this.resendStateStore.load(user.id, new Date());

      if (state.kind === EmailVerificationResendStatus.AVAILABLE) {
        return {
          status: EmailVerificationResendStatus.AVAILABLE,
          available: true,
          manualResendsUsed: state.manualResendsUsed,
          manualResendsRemaining: state.manualResendsRemaining,
          lastLogicalSendAt: state.lastLogicalSendAt,
        };
      }

      return {
        status: EmailVerificationResendStatus.BLOCKED,
        available: false,
        blockedBy: state.blockedBy,
        retryAfterSeconds: state.retryAfterSeconds,
        manualResendsUsed: state.manualResendsUsed,
        manualResendsRemaining: state.manualResendsRemaining,
        lastLogicalSendAt: state.lastLogicalSendAt,
      };
    } catch {
      throw new EmailVerificationStateUnavailableError();
    }
  }
}
