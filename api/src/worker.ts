import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertProcessRole } from './app/assert-process-role';
import { getWorkerInstanceId } from './app/worker-instance';
import { WorkerModule } from './app/worker.module';

async function bootstrap(): Promise<void> {
  assertProcessRole(ProcessRoles.WORKER);

  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  Logger.log(
    `Worker started. processRole=${ProcessRoles.WORKER} instanceId=${getWorkerInstanceId()} pid=${process.pid} capabilities=outbox,email,events`,
    'WorkerBootstrap',
  );
}

void bootstrap().catch(error => {
  Logger.error(error instanceof Error ? error.message : String(error), undefined, 'WorkerBootstrap');
  process.exitCode = 1;
});
