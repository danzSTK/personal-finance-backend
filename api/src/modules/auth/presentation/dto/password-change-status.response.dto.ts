import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordChangeStatusResponseDto {
  @ApiProperty({
    example: RESPONSE_OBJECT_TYPES.AUTH_PASSWORD_CHANGE_STATUS,
  })
  object: typeof RESPONSE_OBJECT_TYPES.AUTH_PASSWORD_CHANGE_STATUS = RESPONSE_OBJECT_TYPES.AUTH_PASSWORD_CHANGE_STATUS;

  @ApiProperty({
    description: 'Indica se uma alteração de senha pode ser iniciada neste momento.',
    example: true,
  })
  status!: boolean;

  static fromStatus(status: boolean): PasswordChangeStatusResponseDto {
    const dto = new PasswordChangeStatusResponseDto();
    dto.status = status;

    return dto;
  }
}
