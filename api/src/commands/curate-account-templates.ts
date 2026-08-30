import { CurateAccountTemplatesCommandModule } from '@/commands/curate-account-templates.module';
import { CurateInstitutionalAccountTemplatesUseCase } from '@/modules/accounts/application/use-cases/curate-institutional-account-templates/curate-institutional-account-templates.use-case';
import { NestFactory } from '@nestjs/core';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(CurateAccountTemplatesCommandModule, { logger: false });

  try {
    const useCase = app.get(CurateInstitutionalAccountTemplatesUseCase);
    const count = await useCase.execute();
    console.log(`Curated and verified ${count} institutional account template SVGs.`);
  } finally {
    await app.close();
  }
}

void run().catch(error => {
  console.error(error instanceof Error ? error.message : 'Account template curation failed.');
  process.exitCode = 1;
});
