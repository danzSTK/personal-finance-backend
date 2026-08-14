import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeUserPasswordResponseDto {
  @ApiProperty({
    example: RESPONSE_OBJECT_TYPES.AUTH_PASSWORD_CHANGE,
  })
  object: typeof RESPONSE_OBJECT_TYPES.AUTH_PASSWORD_CHANGE = RESPONSE_OBJECT_TYPES.AUTH_PASSWORD_CHANGE;

  @ApiProperty({ enum: ['CHANGED'], example: 'CHANGED' })
  status = 'CHANGED' as const;
}
