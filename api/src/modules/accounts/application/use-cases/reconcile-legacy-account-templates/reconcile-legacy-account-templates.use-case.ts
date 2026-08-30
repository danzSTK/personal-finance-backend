import { AccountTemplateFactory } from '@/modules/accounts/domain/factories/account-template.factory';
import { IAccountTemplateRepository } from '@/modules/accounts/domain/repositories/account-template.repository.interface';
import { IAccountRepository } from '@/modules/accounts/domain/repositories/account.repository.interface';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { isColorToken } from '@/common/models/constants';

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;

@Injectable()
export class ReconcileLegacyAccountTemplatesUseCase {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly accountRepository: IAccountRepository,
    private readonly accountTemplateRepository: IAccountTemplateRepository,
  ) {}

  async execute(batchSize = DEFAULT_BATCH_SIZE): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
      throw new Error(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
    }

    let reconciled = 0;

    while (true) {
      const processed = await this.dataSource.transaction(manager => this.reconcileBatch(batchSize, manager));
      reconciled += processed;

      if (processed < batchSize) {
        return reconciled;
      }
    }
  }

  private async reconcileBatch(batchSize: number, manager: EntityManager): Promise<number> {
    const options = { manager };
    const accounts = await this.accountRepository.findWithoutTemplateForUpdate(batchSize, options);

    for (const account of accounts) {
      const colorToken = account.color;
      const custom = AccountTemplateFactory.createCustom({
        ownerUserId: account.userId,
        name: account.name,
        colorToken: colorToken !== null && isColorToken(colorToken) ? colorToken : null,
        iconKey: account.icon,
      });
      const savedTemplate = await this.accountTemplateRepository.save(custom, options);
      account.associateTemplateForMigration(savedTemplate.id);
      await this.accountRepository.save(account, options);
    }

    return accounts.length;
  }
}
