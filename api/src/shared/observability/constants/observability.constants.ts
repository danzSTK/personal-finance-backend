export const OBSERVABILITY_SERVICE_NAME = 'danfy-backend';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const MAX_REQUEST_ID_LENGTH = 128;
export const REQUEST_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

export const REDACTED_VALUE = '[REDACTED]';
export const HEALTH_ROUTE_PREFIX = '/health';

export const PinoLogLevels = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace',
  SILENT: 'silent',
} as const;

export type PinoLogLevel = (typeof PinoLogLevels)[keyof typeof PinoLogLevels];

export const VALID_LOG_LEVELS = [
  PinoLogLevels.FATAL,
  PinoLogLevels.ERROR,
  PinoLogLevels.WARN,
  PinoLogLevels.INFO,
  PinoLogLevels.DEBUG,
  PinoLogLevels.TRACE,
  PinoLogLevels.SILENT,
] as const;

export const OperationalAlertSeverities = {
  CRITICAL: 'CRITICAL',
  WARN: 'WARN',
  RESOLVED: 'RESOLVED',
} as const;

export type OperationalAlertSeverity = (typeof OperationalAlertSeverities)[keyof typeof OperationalAlertSeverities];

export const ObservabilityMetricTypes = {
  COUNTER: 'counter',
  HISTOGRAM: 'histogram',
} as const;

export type ObservabilityMetricType = (typeof ObservabilityMetricTypes)[keyof typeof ObservabilityMetricTypes];

export const ObservabilityLogEvents = {
  UNHANDLED_HTTP_EXCEPTION: 'UNHANDLED_HTTP_EXCEPTION',
  ASSET_DELETE_QUARANTINED: 'ASSET_DELETE_QUARANTINED',
  OPERATIONAL_ALERT_SUPPRESSED: 'OPERATIONAL_ALERT_SUPPRESSED',
  OPERATIONAL_ALERT_DELIVERY_FAILED: 'OPERATIONAL_ALERT_DELIVERY_FAILED',
  OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR: 'OPERATIONAL_ALERT_COOLDOWN_REDIS_ERROR',
  METRIC_RECORDED: 'METRIC_RECORDED',
} as const;

export const OperationalAlertKeys = {
  http500: (method: string, normalizedRoute: string): string => `api:http-500:${method}:${normalizedRoute}`,
  assetQuarantine: (assetId: string): string => `worker:asset-reconciler:quarantine:${assetId}`,
} as const;

export const EnvironmentLabels = {
  PRODUCTION: 'PROD',
  STAGING: 'STAGING',
  DEVELOPMENT: 'DEV',
  TEST: 'TEST',
} as const;

export const DEFAULT_TELEGRAM_API_BASE_URL = 'https://api.telegram.org';
export const DEFAULT_TELEGRAM_ALERT_TIMEOUT_MS = 4000;
export const DEFAULT_ALERT_COOLDOWN_CRITICAL_SECONDS = 900;
export const DEFAULT_ALERT_COOLDOWN_WARN_SECONDS = 1800;
export const MEMORY_COOLDOWN_MAX_ENTRIES = 1000;

export const SENSITIVE_QUERY_PARAMS = [
  'token',
  'access_token',
  'refresh_token',
  'code',
  'state',
  'password',
  'key',
  'hash',
  'p',
  'secret',
  'api_key',
  'cpf',
  'cnpj',
] as const;

export const PINO_REDACT_PATHS: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.confirmPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.apiKey',
  '*.botToken',
  '*.cpf',
  '*.cnpj',
  '*.consumerDocument',
  '*.consumerName',
  '*.rawHtml',
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'botToken',
  'cpf',
  'cnpj',
  'consumerDocument',
  'consumerName',
  'rawHtml',
];
