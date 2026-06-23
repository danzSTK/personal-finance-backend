import { APP_COLOR_TOKENS, APP_ICON_TOKENS } from '@/common/models/constants';
import { Injectable } from '@nestjs/common';
import { GetCategoryMetadataUseCaseOutput } from './get-category-metadata.dto';

@Injectable()
export class GetCategoryMetadataUseCase {
  execute(): GetCategoryMetadataUseCaseOutput {
    return {
      icons: APP_ICON_TOKENS,
      colors: APP_COLOR_TOKENS,
    };
  }
}
