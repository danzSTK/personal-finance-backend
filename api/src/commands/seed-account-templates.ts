import { SeedInstitutionalAccountTemplatesUseCase } from '@/modules/accounts/application/use-cases/seed-institutional-account-templates/seed-institutional-account-templates.use-case';
import { AccountTemplateOrmEntity } from '@/modules/accounts/infrastructure/persistence/account-template-orm.entity';
import { AccountTemplateRepository } from '@/modules/accounts/infrastructure/persistence/account-template.repository';
import { AppDataSource } from '@/database/data-source';

async function run(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const repository = new AccountTemplateRepository(AppDataSource.getRepository(AccountTemplateOrmEntity));
    const useCase = new SeedInstitutionalAccountTemplatesUseCase(AppDataSource, repository);
    const count = await useCase.execute();
    console.log(`Seeded ${count} institutional account templates.`);
  } finally {
    await AppDataSource.destroy();
  }
}

void run().catch(error => {
  console.error(error instanceof Error ? error.message : 'Account template seed failed.');
  process.exitCode = 1;
});
