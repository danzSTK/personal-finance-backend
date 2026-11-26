import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { assertProcessRole } from '@/app/shared/assert-process-role';
import { getWorkerInstanceId } from '@/app/worker/operations/worker-instance';
import { WorkerModule } from '@/app/worker/worker.module';
import { OutboxProcessorService } from '@/shared/outbox/services/outbox-processor.service';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger as PinoNestLogger } from 'nestjs-pino';

async function bootstrap(): Promise<void> {
  assertProcessRole(ProcessRoles.WORKER);

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(PinoNestLogger));
  app.enableShutdownHooks();
  await app.get(OutboxProcessorService).start();

  Logger.log(
    `Worker started. processRole=${ProcessRoles.WORKER} instanceId=${getWorkerInstanceId()} pid=${process.pid} capabilities=outbox,email,events`,
    'WorkerBootstrap',
  );
}

void bootstrap().catch(error => {
  Logger.error(error instanceof Error ? error.message : String(error), undefined, 'WorkerBootstrap');
  process.exitCode = 1;
});
