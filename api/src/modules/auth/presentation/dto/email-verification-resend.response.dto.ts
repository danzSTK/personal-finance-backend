import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export class EmailVerificationResendResponseDto {
  @ApiProperty({
    example: RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND,
  })
  object: typeof RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND = RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_RESEND;

  @ApiProperty({ enum: ['QUEUED', 'ALREADY_VERIFIED'], example: 'QUEUED' })
  status!: 'QUEUED' | 'ALREADY_VERIFIED';

  static fromStatus(status: 'QUEUED' | 'ALREADY_VERIFIED'): EmailVerificationResendResponseDto {
    const dto = new EmailVerificationResendResponseDto();
    dto.status = status;

    return dto;
  }
}
