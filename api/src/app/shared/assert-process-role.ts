import { type ProcessRole, ProcessRoles } from '@/common/models/constants/process-role.constants';

export const assertProcessRole = (expectedRole: ProcessRole): void => {
  const configuredRole = process.env.PROCESS_ROLE ?? ProcessRoles.API;

  if (configuredRole !== expectedRole) {
    throw new Error(`Process role mismatch: expected ${expectedRole}, received ${configuredRole}.`);
  }
};
