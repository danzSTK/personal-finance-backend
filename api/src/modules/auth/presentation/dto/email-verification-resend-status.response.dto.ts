import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { GetEmailVerificationResendStatusOutput } from '@/modules/auth/application/use-cases/get-email-verification-resend-status/get-email-verification-resend-status.dto';
import {
  EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT,
  EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS,
  EmailVerificationResendRestriction,
  EmailVerificationResendStatus,
} from '@/modules/auth/domain/constants/email-verification.constants';
import { ApiProperty } from '@nestjs/swagger';

abstract class EmailVerificationResendStatusCountersDto {
  @ApiProperty({ example: 2 })
  manualResendsUsed!: number;

  @ApiProperty({ example: 3 })
  manualResendsRemaining!: number;

  @ApiProperty({ example: EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT })
  manualResendLimit: typeof EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT = EMAIL_VERIFICATION_MANUAL_RESEND_LIMIT;

  @ApiProperty({ example: EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS })
  windowSeconds: typeof EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS =
    EMAIL_VERIFICATION_MANUAL_RESEND_WINDOW_SECONDS;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLogicalSendAt!: string | null;

  protected assignCounters(
    result: Extract<
      GetEmailVerificationResendStatusOutput,
      {
        status: typeof EmailVerificationResendStatus.AVAILABLE | typeof EmailVerificationResendStatus.BLOCKED;
      }
    >,
  ): void {
    this.manualResendsUsed = result.manualResendsUsed;
    this.manualResendsRemaining = result.manualResendsRemaining;
    this.lastLogicalSendAt = result.lastLogicalSendAt?.toISOString() ?? null;
  }
}

export class EmailVerificationResendStatusAvailableResponseDto extends EmailVerificationResendStatusCountersDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_AVAILABLE })
  object: typeof RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_AVAILABLE =
    RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_AVAILABLE;

  @ApiProperty({ example: EmailVerificationResendStatus.AVAILABLE })
  status: typeof EmailVerificationResendStatus.AVAILABLE = EmailVerificationResendStatus.AVAILABLE;

  @ApiProperty({ example: true })
  available: true = true as const;

  @ApiProperty({ type: Number, nullable: true, example: null })
  retryAfterSeconds: null = null;

  static fromResult(
    result: Extract<GetEmailVerificationResendStatusOutput, { status: typeof EmailVerificationResendStatus.AVAILABLE }>,
  ): EmailVerificationResendStatusAvailableResponseDto {
    const dto = new EmailVerificationResendStatusAvailableResponseDto();
    dto.assignCounters(result);

    return dto;
  }
}

export class EmailVerificationResendStatusBlockedResponseDto extends EmailVerificationResendStatusCountersDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_BLOCKED })
  object: typeof RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_BLOCKED =
    RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_BLOCKED;

  @ApiProperty({ example: EmailVerificationResendStatus.BLOCKED })
  status: typeof EmailVerificationResendStatus.BLOCKED = EmailVerificationResendStatus.BLOCKED;

  @ApiProperty({ example: false })
  available: false = false as const;

  @ApiProperty({ enum: Object.values(EmailVerificationResendRestriction), example: 'COOLDOWN' })
  blockedBy!: EmailVerificationResendRestriction;

  @ApiProperty({ minimum: 1, example: 91 })
  retryAfterSeconds!: number;

  static fromResult(
    result: Extract<GetEmailVerificationResendStatusOutput, { status: typeof EmailVerificationResendStatus.BLOCKED }>,
  ): EmailVerificationResendStatusBlockedResponseDto {
    const dto = new EmailVerificationResendStatusBlockedResponseDto();
    dto.assignCounters(result);
    dto.blockedBy = result.blockedBy;
    dto.retryAfterSeconds = result.retryAfterSeconds;

    return dto;
  }
}

export class EmailVerificationResendStatusAlreadyVerifiedResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_ALREADY_VERIFIED })
  object: typeof RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_ALREADY_VERIFIED =
    RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND_STATUS_ALREADY_VERIFIED;

  @ApiProperty({ example: EmailVerificationResendStatus.ALREADY_VERIFIED })
  status: typeof EmailVerificationResendStatus.ALREADY_VERIFIED = EmailVerificationResendStatus.ALREADY_VERIFIED;

  @ApiProperty({ example: false })
  available: false = false as const;

  @ApiProperty({ type: Number, nullable: true, example: null })
  retryAfterSeconds: null = null;
}

export type EmailVerificationResendStatusResponseDto =
  | EmailVerificationResendStatusAvailableResponseDto
  | EmailVerificationResendStatusBlockedResponseDto
  | EmailVerificationResendStatusAlreadyVerifiedResponseDto;

export const toEmailVerificationResendStatusResponseDto = (
  result: GetEmailVerificationResendStatusOutput,
): EmailVerificationResendStatusResponseDto => {
  switch (result.status) {
    case EmailVerificationResendStatus.AVAILABLE:
      return EmailVerificationResendStatusAvailableResponseDto.fromResult(result);
    case EmailVerificationResendStatus.BLOCKED:
      return EmailVerificationResendStatusBlockedResponseDto.fromResult(result);
    case EmailVerificationResendStatus.ALREADY_VERIFIED:
      return new EmailVerificationResendStatusAlreadyVerifiedResponseDto();
  }
};
