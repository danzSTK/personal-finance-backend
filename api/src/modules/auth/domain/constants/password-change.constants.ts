export const PasswordChangeEventType = {
  CURRENT_PASSWORD_FAILED: 'CURRENT_PASSWORD_FAILED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  FAILED_ATTEMPTS_BLOCK_STARTED: 'FAILED_ATTEMPTS_BLOCK_STARTED',
} as const;

export type PasswordChangeEventType = (typeof PasswordChangeEventType)[keyof typeof PasswordChangeEventType];

const MINUTE_IN_MS = 60_000;
const HOUR_IN_MS = 60 * MINUTE_IN_MS;

export const PASSWORD_CHANGE_FAILED_ATTEMPTS_LIMIT = 5;
export const PASSWORD_CHANGE_FAILURE_WINDOW_MS = 15 * MINUTE_IN_MS;
export const PASSWORD_CHANGE_FIRST_BLOCK_DURATION_MS = 1 * HOUR_IN_MS;
export const PASSWORD_CHANGE_RECURRENT_BLOCK_DURATION_MS = 24 * HOUR_IN_MS;
export const PASSWORD_CHANGE_BLOCK_RECURRENCE_WINDOW_MS = 24 * HOUR_IN_MS;

export const PASSWORD_CHANGE_COOLDOWN_MS = 10 * MINUTE_IN_MS;
export const PASSWORD_CHANGE_COMPLETED_LIMIT = 3;
export const PASSWORD_CHANGE_COMPLETED_WINDOW_MS = 24 * HOUR_IN_MS;
export const PASSWORD_CHANGE_USER_AGENT_MAX_LENGTH = 512;
export const PASSWORD_CHANGE_METADATA_VALUE_MAX_LENGTH = 256;
export const PASSWORD_CHANGE_EVENT_METADATA_KEYS = [
  'location',
  'browser',
  'operatingSystem',
  'os',
  'device',
  'correlationId',
  'requestId',
] as const;

export const PASSWORD_CHANGE_STATE_INITIALIZED_TTL_MS = 25 * 60 * 60 * 1_000;
export const PASSWORD_CHANGE_MUTATION_PENDING_TTL_MS = 2 * 60 * 1_000;

export const PASSWORD_CHANGE_COST_LIMITS = {
  session: {
    limit: 6,
    windowMs: 60_000,
  },
  ip: {
    limit: 30,
    windowMs: 60_000,
  },
} as const;
