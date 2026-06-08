import { ApiProperty } from '@nestjs/swagger';

export class PlatformErrorResponseDto {
  @ApiProperty({ example: 409 })
  statusCode: number;

  @ApiProperty({ example: 'ACCOUNT_ARCHIVED' })
  code: string;

  @ApiProperty({ example: 'Archived account cannot be updated.' })
  message: string;

  @ApiProperty({ example: '/accounts/5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2' })
  path: string;

  @ApiProperty({ example: '2026-06-08T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
    example: {
      fields: [{ field: 'email', messages: ['email must be an email'] }],
    },
  })
  details: Record<string, unknown> | null;
}
