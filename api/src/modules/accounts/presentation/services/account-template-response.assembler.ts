import objectStorageConfig from '@/config/object-storage.config';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { AccountTemplateResponseDto } from '@/modules/accounts/presentation/dto/account-template.response.dto';
import { IObjectStorage } from '@/shared/object-storage';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

@Injectable()
export class AccountTemplateResponseAssembler {
  constructor(
    @Inject(objectStorageConfig.KEY)
    private readonly storageConfig: ConfigType<typeof objectStorageConfig>,
    private readonly objectStorage: IObjectStorage,
  ) {}

  toDto(template: AccountTemplate): AccountTemplateResponseDto {
    const logoUrl = template.logoStorageKey
      ? this.objectStorage.buildPublicUrl({
          bucket: this.storageConfig.publicBucketName,
          key: template.logoStorageKey,
        })
      : null;

    return AccountTemplateResponseDto.fromDomain(template, logoUrl);
  }
}
