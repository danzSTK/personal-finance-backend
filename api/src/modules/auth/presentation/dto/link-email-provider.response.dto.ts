import { RESPONSE_OBJECT_TYPES } from '@/common/models/constants';
import { ApiProperty } from '@nestjs/swagger';

export class LinkEmailProviderResponseDto {
  @ApiProperty({ example: RESPONSE_OBJECT_TYPES.AUTH_PROVIDER_EMAIL_LINK })
  object: typeof RESPONSE_OBJECT_TYPES.AUTH_PROVIDER_EMAIL_LINK = RESPONSE_OBJECT_TYPES.AUTH_PROVIDER_EMAIL_LINK;

  @ApiProperty({ example: 'Email provider linked successfully' })
  message = 'Email provider linked successfully' as const;
}
