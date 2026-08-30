import { applyIfDefined } from '@/common/utils/utils';
import {
  UpdateAccountUseCaseInput,
  UpdateAccountUseCaseOutput,
} from '@/modules/accounts/application/use-cases/update-account/update-account.dto';
import {
  AccountArchivedError,
  AccountNotFoundError,
  AccountTemplateInputConflictError,
  AccountTemplateNotFoundError,
  AccountUpdateEmptyError,
} from '@/modules/accounts/application/errors';
import { IAccountCacheInvalidator } from '@/modules/accounts/application/ports/account-cache-invalidator.interface';
import { isColorToken } from '@/common/models/constants';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { AccountTemplateFactory } from '@/modules/accounts/domain/factories/account-template.factory';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACCOUNT_TEMPLATE_INPUT_TYPE } from '@/modules/accounts/application/models/account-template-input';
import { projectAccountTemplateToLegacyVisual } from '@/modules/accounts/application/models/account-template-legacy-visual';

@Injectable()
export class UpdateAccountUseCase {
  private readonly logger = new Logger(UpdateAccountUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accountRepository: IAccountRepository,
    private readonly accountTemplateRepository: IAccountTemplateRepository,
    private readonly accountCacheInvalidator: IAccountCacheInvalidator,
  ) {}

  async execute(data: UpdateAccountUseCaseInput): Promise<UpdateAccountUseCaseOutput> {
    this.validatePatch(data);
    const output = await this.dataSource.transaction(manager => this.updateInTransaction(data, manager));

    try {
      await this.accountCacheInvalidator.invalidateUserAccounts(data.userId);
    } catch (error) {
      this.logger.error(
        `Account updated but cache invalidation failed userId=${data.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return output;
  }

  private async updateInTransaction(
    data: UpdateAccountUseCaseInput,
    manager: EntityManager,
  ): Promise<UpdateAccountUseCaseOutput> {
    const options = { manager };
    const account = await this.accountRepository.findByIdAndUserId(data.accountId, data.userId, options);

    if (!account) {
      throw new AccountNotFoundError();
    }

    if (account.isArchived) {
      throw new AccountArchivedError('Archived account cannot be updated.');
    }

    applyIfDefined(data.patch.name, value => account.changerName(value));
    applyIfDefined(data.patch.type, value => account.changerType(value));
    applyIfDefined(data.patch.includeInTotal, value => account.changerIncludeInTotal(value));

    const template = await this.resolveVisualTemplate(account, data, manager);
    const savedAccount = await this.accountRepository.save(account, options);

    return { account: savedAccount, template };
  }

  private async resolveVisualTemplate(
    account: Account,
    data: UpdateAccountUseCaseInput,
    manager: EntityManager,
  ): Promise<AccountTemplate> {
    if (data.patch.template?.type === ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL) {
      const selected = await this.accountTemplateRepository.findActiveInstitutionalById(
        data.patch.template.templateId,
        { manager },
      );

      if (!selected || selected.type !== ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL) {
        throw new AccountTemplateNotFoundError();
      }

      const legacyVisual = projectAccountTemplateToLegacyVisual(selected);
      account.changeTemplate(selected.id, legacyVisual.color, legacyVisual.icon);
      return selected;
    }

    const current = await this.findCurrentTemplate(account, data.userId, manager);

    if (data.patch.template?.type === ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM) {
      return this.applyCustomTemplateInput(account, current, data, manager);
    }

    const hasLegacyVisualPatch = data.patch.color !== undefined || data.patch.icon !== undefined;
    const expectedVisual = current ? projectAccountTemplateToLegacyVisual(current) : { color: null, icon: null };
    const legacyDiverged =
      current !== null && (account.color !== expectedVisual.color || account.icon !== expectedVisual.icon);

    if (!hasLegacyVisualPatch && current && !legacyDiverged) {
      if (
        current.type === ACCOUNT_TEMPLATE_TYPE.CUSTOM &&
        current.ownerUserId === data.userId &&
        current.name !== account.name
      ) {
        const currentColorToken =
          current.colorToken !== null && isColorToken(current.colorToken) ? current.colorToken : null;
        return this.saveCustomTemplate(account, current, data.userId, currentColorToken, current.iconKey, manager);
      }

      return current;
    }

    const colorCandidate = data.patch.color !== undefined ? data.patch.color : account.color;
    const legacyColor = colorCandidate !== null && isColorToken(colorCandidate) ? colorCandidate : null;
    const legacyIcon = data.patch.icon !== undefined ? data.patch.icon : account.icon;

    return this.saveCustomTemplate(account, current, data.userId, legacyColor, legacyIcon, manager);
  }

  private async applyCustomTemplateInput(
    account: Account,
    current: AccountTemplate | null,
    data: UpdateAccountUseCaseInput,
    manager: EntityManager,
  ): Promise<AccountTemplate> {
    const input = data.patch.template;

    if (!input || input.type !== ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM) {
      throw new AccountTemplateInputConflictError();
    }

    const currentCustom =
      current?.type === ACCOUNT_TEMPLATE_TYPE.CUSTOM && current.ownerUserId === data.userId ? current : null;
    const currentColorToken = currentCustom?.colorToken;
    const customColorToken = currentColorToken && isColorToken(currentColorToken) ? currentColorToken : null;
    const colorToken = input.colorToken !== undefined ? input.colorToken : customColorToken;
    const iconKey = input.iconKey !== undefined ? input.iconKey : (currentCustom?.iconKey ?? null);

    return this.saveCustomTemplate(account, currentCustom, data.userId, colorToken, iconKey, manager);
  }

  private async saveCustomTemplate(
    account: Account,
    current: AccountTemplate | null,
    userId: string,
    colorToken: Parameters<typeof AccountTemplateFactory.createCustom>[0]['colorToken'],
    iconKey: Parameters<typeof AccountTemplateFactory.createCustom>[0]['iconKey'],
    manager: EntityManager,
  ): Promise<AccountTemplate> {
    const custom =
      current?.type === ACCOUNT_TEMPLATE_TYPE.CUSTOM && current.ownerUserId === userId
        ? current
        : AccountTemplateFactory.createCustom({
            ownerUserId: userId,
            name: account.name,
            colorToken,
            iconKey,
          });

    if (custom === current) {
      custom.updateCustomVisualIdentity({
        ownerUserId: userId,
        name: account.name,
        colorToken,
        iconKey,
      });
    }

    const savedTemplate = await this.accountTemplateRepository.save(custom, { manager });
    const legacyVisual = projectAccountTemplateToLegacyVisual(savedTemplate);
    account.changeTemplate(savedTemplate.id, legacyVisual.color, legacyVisual.icon);
    return savedTemplate;
  }

  private async findCurrentTemplate(
    account: Account,
    userId: string,
    manager: EntityManager,
  ): Promise<AccountTemplate | null> {
    if (!account.templateId) {
      return null;
    }

    const templates = await this.accountTemplateRepository.findByIdsForRendering([account.templateId], userId, {
      manager,
    });

    return templates[0] ?? null;
  }

  private validatePatch(data: UpdateAccountUseCaseInput): void {
    const hasAnyField = Object.values(data.patch).some(value => value !== undefined);

    if (!hasAnyField) {
      throw new AccountUpdateEmptyError();
    }

    if (data.patch.template !== undefined && (data.patch.color !== undefined || data.patch.icon !== undefined)) {
      throw new AccountTemplateInputConflictError();
    }
  }
}
