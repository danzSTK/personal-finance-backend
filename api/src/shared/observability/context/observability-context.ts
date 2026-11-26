import { AsyncLocalStorage } from 'node:async_hooks';

export interface ObservabilityContext {
  requestId?: string;
  jobId?: string;
  queueName?: string;
  jobName?: string;
  correlationId?: string;
}

export interface JobLogContextInput {
  jobId?: string;
  queueName: string;
  jobName: string;
  correlationId?: string;
}

const observabilityStorage = new AsyncLocalStorage<ObservabilityContext>();

export const getObservabilityContext = (): ObservabilityContext | undefined => {
  return observabilityStorage.getStore();
};

export const runWithObservabilityContext = <T>(context: ObservabilityContext, fn: () => T): T => {
  const current = observabilityStorage.getStore();
  const merged: ObservabilityContext = {
    ...current,
    ...Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)),
  };

  return observabilityStorage.run(merged, fn);
};

export const runWithRequestLogContext = <T>(requestId: string, fn: () => T): T => {
  return runWithObservabilityContext({ requestId }, fn);
};

export const runWithJobLogContext = <T>(context: JobLogContextInput, fn: () => T): T => {
  return runWithObservabilityContext(
    {
      jobId: context.jobId,
      queueName: context.queueName,
      jobName: context.jobName,
      correlationId: context.correlationId,
    },
    fn,
  );
};
