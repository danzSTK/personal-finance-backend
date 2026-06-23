import { UpdateUserAvatarOutput } from '@/modules/users/application/use-cases/update-user-avatar/update-user-avatar.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserAvatarResponseDto {
  @ApiProperty({ format: 'uuid' })
  assetId!: string;

  @ApiProperty({ format: 'uri' })
  url!: string;

  static fromOutput(output: UpdateUserAvatarOutput): UpdateUserAvatarResponseDto {
    return {
      assetId: output.assetId,
      url: output.url,
    };
  }
}
