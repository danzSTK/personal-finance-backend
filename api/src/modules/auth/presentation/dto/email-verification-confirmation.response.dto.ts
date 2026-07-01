import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export class EmailVerificationConfirmationResponseDto {
  @ApiProperty({
    example: RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_CONFIRMATION,
  })
  object: typeof RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_CONFIRMATION =
    RESPONSE_OBJECT_TYPES.EMAIL_VERIFICATION_CONFIRMATION;

  @ApiProperty({ example: 'VERIFIED' })
  status!: 'VERIFIED';

  static verified(): EmailVerificationConfirmationResponseDto {
    const dto = new EmailVerificationConfirmationResponseDto();
    dto.status = 'VERIFIED';

    return dto;
  }
}
