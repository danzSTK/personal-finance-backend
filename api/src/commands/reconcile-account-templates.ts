import { ReconcileLegacyAccountTemplatesUseCase } from '@/modules/accounts/application/use-cases/reconcile-legacy-account-templates/reconcile-legacy-account-templates.use-case';
import { AccountTemplateOrmEntity } from '@/modules/accounts/infrastructure/persistence/account-template-orm.entity';
import { AccountTemplateRepository } from '@/modules/accounts/infrastructure/persistence/account-template.repository';
import { AccountOrmEntity } from '@/modules/accounts/infrastructure/persistence/account.entity';
import { AccountRepository } from '@/modules/accounts/infrastructure/persistence/account.repository';
import { AppDataSource } from '@/database/data-source';

async function run(): Promise<void> {
  const batchSize = process.argv[2] === undefined ? 100 : Number(process.argv[2]);
  await AppDataSource.initialize();

  try {
    const accountRepository = new AccountRepository(AppDataSource.getRepository(AccountOrmEntity));
    const templateRepository = new AccountTemplateRepository(AppDataSource.getRepository(AccountTemplateOrmEntity));
    const useCase = new ReconcileLegacyAccountTemplatesUseCase(AppDataSource, accountRepository, templateRepository);
    const count = await useCase.execute(batchSize);
    console.log(`Reconciled ${count} legacy accounts with custom templates.`);
  } finally {
    await AppDataSource.destroy();
  }
}

void run().catch(error => {
  console.error(error instanceof Error ? error.message : 'Account template reconciliation failed.');
  process.exitCode = 1;
});
