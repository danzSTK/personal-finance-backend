import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { EmailVerificationResendStatus } from '@/modules/auth/domain/constants/email-verification.constants';
import { ApiProperty } from '@nestjs/swagger';

export class EmailVerificationResendResponseDto {
  @ApiProperty({
    example: RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND,
  })
  object: typeof RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND = RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND;

  @ApiProperty({
    enum: [EmailVerificationResendStatus.QUEUED, EmailVerificationResendStatus.ALREADY_VERIFIED],
    example: EmailVerificationResendStatus.QUEUED,
  })
  status!: typeof EmailVerificationResendStatus.QUEUED | typeof EmailVerificationResendStatus.ALREADY_VERIFIED;

  static fromStatus(
    status: typeof EmailVerificationResendStatus.QUEUED | typeof EmailVerificationResendStatus.ALREADY_VERIFIED,
  ): EmailVerificationResendResponseDto {
    const dto = new EmailVerificationResendResponseDto();
    dto.status = status;

    return dto;
  }
}
