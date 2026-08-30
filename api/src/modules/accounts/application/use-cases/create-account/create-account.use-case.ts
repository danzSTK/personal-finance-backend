import {
  CreateAccountUseCaseInput,
  CreateAccountUseCaseOutput,
} from '@/modules/accounts/application/use-cases/create-account/create-account.dto';
import { Account } from '@/modules/accounts/domain/entities/account.entity';
import { AccountTemplateInputConflictError, AccountTemplateNotFoundError } from '@/modules/accounts/application/errors';
import { IAccountCacheInvalidator } from '@/modules/accounts/application/ports/account-cache-invalidator.interface';
import { AccountTemplate } from '@/modules/accounts/domain/entities/account-template.entity';
import { ACCOUNT_TEMPLATE_TYPE } from '@/modules/accounts/domain/enums/account-template-type.enum';
import { AccountTemplateFactory } from '@/modules/accounts/domain/factories/account-template.factory';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { AccountFactory } from '@/modules/accounts/domain/factories/account.factory';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { ACCOUNT_TEMPLATE_INPUT_TYPE } from '@/modules/accounts/application/models/account-template-input';
import { projectAccountTemplateToLegacyVisual } from '@/modules/accounts/application/models/account-template-legacy-visual';

@Injectable()
export class CreateAccountUseCase {
  private readonly logger = new Logger(CreateAccountUseCase.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accountRepository: IAccountRepository,
    private readonly accountTemplateRepository: IAccountTemplateRepository,
    private readonly accountCacheInvalidator: IAccountCacheInvalidator,
  ) {}

  async execute(data: CreateAccountUseCaseInput): Promise<CreateAccountUseCaseOutput> {
    this.ensureVisualInputIsUnambiguous(data);

    const output = await this.dataSource.transaction(manager => this.createInTransaction(data, manager));

    try {
      await this.accountCacheInvalidator.invalidateUserAccounts(data.userId);
    } catch (error) {
      this.logger.error(
        `Account created but cache invalidation failed userId=${data.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }

    return output;
  }

  private async createInTransaction(
    data: CreateAccountUseCaseInput,
    manager: EntityManager,
  ): Promise<CreateAccountUseCaseOutput> {
    const options = { manager };
    const hasDefaultAccount = await this.accountRepository.userHasDefaultAccount(data.userId, options);
    const shouldSetAsDefault = data.isDefault === true || !hasDefaultAccount;

    if (shouldSetAsDefault) {
      await this.accountRepository.unsetDefaultAccount(data.userId, options);
    }

    const template = await this.resolveTemplate(data, manager);
    const account: Account = AccountFactory.createManualAccount(data, shouldSetAsDefault);
    const legacyVisual = projectAccountTemplateToLegacyVisual(template);

    account.changeTemplate(template.id, legacyVisual.color, legacyVisual.icon);
    const savedAccount = await this.accountRepository.save(account, options);

    return { account: savedAccount, template };
  }

  private async resolveTemplate(data: CreateAccountUseCaseInput, manager: EntityManager): Promise<AccountTemplate> {
    if (data.template?.type === ACCOUNT_TEMPLATE_INPUT_TYPE.INSTITUTIONAL) {
      const selected = await this.accountTemplateRepository.findActiveInstitutionalById(data.template.templateId, {
        manager,
      });

      if (!selected || selected.type !== ACCOUNT_TEMPLATE_TYPE.INSTITUTIONAL) {
        throw new AccountTemplateNotFoundError();
      }

      return selected;
    }

    const customInput = data.template?.type === ACCOUNT_TEMPLATE_INPUT_TYPE.CUSTOM ? data.template : null;
    const custom = AccountTemplateFactory.createCustom({
      ownerUserId: data.userId,
      name: data.name,
      colorToken: customInput ? (customInput.colorToken ?? null) : (data.color ?? null),
      iconKey: customInput ? (customInput.iconKey ?? null) : (data.icon ?? null),
    });

    return this.accountTemplateRepository.save(custom, { manager });
  }

  private ensureVisualInputIsUnambiguous(data: CreateAccountUseCaseInput): void {
    if (data.template !== undefined && (data.color !== undefined || data.icon !== undefined)) {
      throw new AccountTemplateInputConflictError();
    }
  }
}
