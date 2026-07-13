import { assertProcessRole } from '@/app/assert-process-role';
import { WorkerHealthModule } from '@/app/worker-health.module';
import { WorkerHealthService } from '@/app/worker-health.service';
import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

async function run(): Promise<void> {
  assertProcessRole(ProcessRoles.WORKER);
  const app = await NestFactory.createApplicationContext(WorkerHealthModule, { logger: false });

  try {
    await app.get(WorkerHealthService).check();
  } finally {
    await app.close();
  }
}

void run().catch(error => {
  Logger.error(error instanceof Error ? error.message : String(error), undefined, 'WorkerHealth');
  process.exitCode = 1;
});
