import { ColorToken, IconKey } from '@/common/models/enums';

export interface CategoryIconMetadata {
  key: IconKey;
  label: string;
}

export interface CategoryColorMetadata {
  key: ColorToken;
  label: string;
  hex: string;
}

export interface GetCategoryMetadataUseCaseOutput {
  icons: readonly CategoryIconMetadata[];
  colors: readonly CategoryColorMetadata[];
}
