export const ProcessRoles = {
  API: 'api',
  WORKER: 'worker',
} as const;

export type ProcessRole = (typeof ProcessRoles)[keyof typeof ProcessRoles];
