import { ColorToken, IconKey } from '@/common/models/enums';
import { GetCategoryMetadataUseCaseOutput } from '@/modules/categories/application/use-cases/get-category-metadata/get-category-metadata.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CategoryIconMetadataResponseDto {
  @ApiProperty({ enum: IconKey, example: IconKey.WALLET })
  key: IconKey;

  @ApiProperty({ example: 'Carteira' })
  label: string;
}

export class CategoryColorMetadataResponseDto {
  @ApiProperty({ enum: ColorToken, example: ColorToken.BLUE })
  key: ColorToken;

  @ApiProperty({ example: 'Azul' })
  label: string;

  @ApiProperty({ example: '#3B82F6' })
  hex: string;
}

export class CategoryMetadataResponseDto {
  @ApiProperty({ type: [CategoryIconMetadataResponseDto] })
  icons: CategoryIconMetadataResponseDto[];

  @ApiProperty({ type: [CategoryColorMetadataResponseDto] })
  colors: CategoryColorMetadataResponseDto[];

  static fromUseCaseOutput(output: GetCategoryMetadataUseCaseOutput): CategoryMetadataResponseDto {
    return {
      icons: [...output.icons],
      colors: [...output.colors],
    };
  }
}
