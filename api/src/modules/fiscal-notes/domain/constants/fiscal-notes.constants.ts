export const FiscalNoteErrorCodes = {
  INVALID_FISCAL_NOTE: 'INVALID_FISCAL_NOTE',
  FISCAL_NOTE_INVALID_INPUT: 'FISCAL_NOTE_INVALID_INPUT',
  FISCAL_NOTE_UNSUPPORTED_UF: 'FISCAL_NOTE_UNSUPPORTED_UF',
  FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED: 'FISCAL_NOTE_HOMOLOGATION_NOT_ALLOWED',
  FISCAL_NOTE_NOT_FOUND: 'FISCAL_NOTE_NOT_FOUND',
  FISCAL_NOTE_SEFAZ_NOT_FOUND: 'FISCAL_NOTE_SEFAZ_NOT_FOUND',
  FISCAL_NOTE_CANCELLED_OR_DENIED: 'FISCAL_NOTE_CANCELLED_OR_DENIED',
  FISCAL_NOTE_ALREADY_IMPORTED: 'FISCAL_NOTE_ALREADY_IMPORTED',
  TRANSACTION_ALREADY_HAS_FISCAL_NOTE: 'TRANSACTION_ALREADY_HAS_FISCAL_NOTE',
  FISCAL_NOTE_RATE_LIMIT_EXCEEDED: 'FISCAL_NOTE_RATE_LIMIT_EXCEEDED',
  SEFAZ_TEMPORARILY_UNAVAILABLE: 'SEFAZ_TEMPORARILY_UNAVAILABLE',
  SEFAZ_TIMEOUT: 'SEFAZ_TIMEOUT',
  FISCAL_NOTE_PARSE_FAILED: 'FISCAL_NOTE_PARSE_FAILED',
  FISCAL_NOTE_RESPONSE_TOO_LARGE: 'FISCAL_NOTE_RESPONSE_TOO_LARGE',
} as const;

export type FiscalNoteErrorCode = (typeof FiscalNoteErrorCodes)[keyof typeof FiscalNoteErrorCodes];

export const FiscalNoteSupportedUfs = {
  CE: '23',
} as const;

export type FiscalNoteSupportedUf = (typeof FiscalNoteSupportedUfs)[keyof typeof FiscalNoteSupportedUfs];

export const FISCAL_NOTE_SUPPORTED_UF_LIST: readonly FiscalNoteSupportedUf[] = Object.values(FiscalNoteSupportedUfs);

export const FISCAL_NOTE_ACCESS_KEY_LENGTH = 44;
export const FISCAL_NOTE_ACCESS_KEY_DATA_LENGTH = 43;
export const FISCAL_NOTE_ACCESS_KEY_UF_START = 0;
export const FISCAL_NOTE_ACCESS_KEY_UF_END = 2;
export const FISCAL_NOTE_ACCESS_KEY_MODEL_START = 20;
export const FISCAL_NOTE_ACCESS_KEY_MODEL_END = 22;
export const FISCAL_NOTE_CNPJ_LENGTH = 14;
export const FISCAL_NOTE_UF_LENGTH = 2;
export const FISCAL_NOTE_INPUT_MAX_LENGTH = 1024;
export const FISCAL_NOTE_MODEL_NFCE = '65';

export const FISCAL_NOTE_NUMBER_MAX_LENGTH = 20;
export const FISCAL_NOTE_SERIES_MAX_LENGTH = 10;
export const FISCAL_NOTE_PROTOCOL_MAX_LENGTH = 64;
export const FISCAL_NOTE_ISSUER_NAME_MAX_LENGTH = 255;
export const FISCAL_NOTE_XML_VERSION_MAX_LENGTH = 16;
export const FISCAL_NOTE_XSLT_VERSION_MAX_LENGTH = 16;
export const FISCAL_NOTE_PARSER_VERSION_MAX_LENGTH = 32;
export const FISCAL_NOTE_ITEM_DESCRIPTION_MAX_LENGTH = 500;
export const FISCAL_NOTE_ITEM_STORE_CODE_MAX_LENGTH = 64;
export const FISCAL_NOTE_ITEM_UNIT_MAX_LENGTH = 20;
export const FISCAL_NOTE_PAYMENT_METHOD_MAX_LENGTH = 120;

export const FISCAL_NOTE_ACCESS_KEY_REGEX = /^\d{44}$/;
export const FISCAL_NOTE_CNPJ_REGEX = /^\d{14}$/;
export const FISCAL_NOTE_UF_REGEX = /^\d{2}$/;

export const FISCAL_NOTE_QR_PARAM_NAME = 'p';
export const FISCAL_NOTE_QR_V2_NORMAL_PARTS = 5;
export const FISCAL_NOTE_QR_V2_CONTINGENCY_PARTS = 8;
export const FISCAL_NOTE_QR_V3_MIN_PARTS = 3;

export const FiscalNoteEnvironments = {
  PRODUCTION: '1',
  HOMOLOGATION: '2',
} as const;

export type FiscalNoteEnvironment = (typeof FiscalNoteEnvironments)[keyof typeof FiscalNoteEnvironments];

export const FiscalNoteQrVersions = {
  V2: '2',
  V3: '3',
} as const;

export type FiscalNoteQrVersion = (typeof FiscalNoteQrVersions)[keyof typeof FiscalNoteQrVersions];

export const FiscalNoteQueryChannels = {
  QRCODE_V2: 'qrcode_v2',
  QRCODE_V3: 'qrcode_v3',
} as const;

export type FiscalNoteQueryChannel = (typeof FiscalNoteQueryChannels)[keyof typeof FiscalNoteQueryChannels];

export const FiscalNoteQueryOutcomes = {
  SUCCESS: 'success',
  BUSINESS_ERROR: 'business_error',
  PARSE_ERROR: 'parse_error',
  TIMEOUT: 'timeout',
  NETWORK_ERROR: 'network_error',
  HTTP_ERROR: 'http_error',
  RESPONSE_TOO_LARGE: 'response_too_large',
  CB_OPEN: 'cb_open',
  RATE_LIMITED: 'rate_limited',
} as const;

export type FiscalNoteQueryOutcome = (typeof FiscalNoteQueryOutcomes)[keyof typeof FiscalNoteQueryOutcomes];

export const FiscalNoteOperations = {
  PREVIEW: 'preview',
  IMPORT: 'import',
  LINK: 'link',
  LIST: 'list',
  GET: 'get',
  UNLINK: 'unlink',
} as const;

export type FiscalNoteOperation = (typeof FiscalNoteOperations)[keyof typeof FiscalNoteOperations];

export const FISCAL_NOTE_LIST_DEFAULT_PAGE = 1;
export const FISCAL_NOTE_LIST_DEFAULT_LIMIT = 20;
export const FISCAL_NOTE_LIST_MAX_LIMIT = 100;
export const FISCAL_NOTE_LIST_SEARCH_MAX_LENGTH = 120;

export const FiscalNoteListSorts = {
  ISSUED_AT_DESC: 'issuedAt:desc',
  ISSUED_AT_ASC: 'issuedAt:asc',
  PAYABLE_AMOUNT_DESC: 'payableAmountCents:desc',
  PAYABLE_AMOUNT_ASC: 'payableAmountCents:asc',
  CREATED_AT_DESC: 'createdAt:desc',
  CREATED_AT_ASC: 'createdAt:asc',
} as const;

export type FiscalNoteListSort = (typeof FiscalNoteListSorts)[keyof typeof FiscalNoteListSorts];

export const FISCAL_NOTE_LIST_SORT_VALUES: readonly FiscalNoteListSort[] = Object.values(FiscalNoteListSorts);
export const FISCAL_NOTE_LIST_DEFAULT_SORT: FiscalNoteListSort = FiscalNoteListSorts.ISSUED_AT_DESC;

export const FiscalNoteCacheLookupResults = {
  HIT: 'hit',
  MISS: 'miss',
} as const;

export type FiscalNoteCacheLookupResult =
  (typeof FiscalNoteCacheLookupResults)[keyof typeof FiscalNoteCacheLookupResults];

export const FiscalNoteLogEvents = {
  FISCAL_NOTE_UNKNOWN_QR_HOST: 'FISCAL_NOTE_UNKNOWN_QR_HOST',
  FISCAL_NOTE_SEFAZ_REQUEST_FAILED: 'FISCAL_NOTE_SEFAZ_REQUEST_FAILED',
  FISCAL_NOTE_SEFAZ_PARSER_FAILURE: 'FISCAL_NOTE_SEFAZ_PARSER_FAILURE',
  FISCAL_NOTE_SEFAZ_CB_OPENED: 'FISCAL_NOTE_SEFAZ_CB_OPENED',
  FISCAL_NOTE_SEFAZ_CB_CLOSED: 'FISCAL_NOTE_SEFAZ_CB_CLOSED',
  FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT: 'FISCAL_NOTE_SEFAZ_GLOBAL_RL_HIT',
  FISCAL_NOTE_CACHE_REDIS_ERROR: 'FISCAL_NOTE_CACHE_REDIS_ERROR',
  FISCAL_NOTE_RATE_LIMIT_REDIS_ERROR: 'FISCAL_NOTE_RATE_LIMIT_REDIS_ERROR',
} as const;

export type FiscalNoteLogEvent = (typeof FiscalNoteLogEvents)[keyof typeof FiscalNoteLogEvents];

export const FiscalNoteMetricNames = {
  SEFAZ_QUERY_TOTAL: 'fiscal_notes.sefaz.query.total',
  SEFAZ_QUERY_DURATION_MS: 'fiscal_notes.sefaz.query.duration_ms',
  CACHE_LOOKUP_TOTAL: 'fiscal_notes.cache.lookup.total',
  OPERATIONS_TOTAL: 'fiscal_notes.operations.total',
} as const;

export type FiscalNoteMetricName = (typeof FiscalNoteMetricNames)[keyof typeof FiscalNoteMetricNames];

export const FiscalNoteAlertKeys = {
  sefazCircuitBreaker: (uf: string) => `fiscal-notes:sefaz:cb:${uf}`,
  sefazParserFailure: (uf: string) => `fiscal-notes:sefaz:parser:${uf}`,
  sefazGlobalRateLimit: (uf: string) => `fiscal-notes:sefaz:global-rl:${uf}`,
  unknownQrHost: (uf: string) => `fiscal-notes:qr:unknown-host:${uf}`,
} as const;

export const FiscalNoteDbConstraints = {
  USER_ACCESS_KEY_ACTIVE: 'UQ_fiscal_notes_user_access_key_active',
  TRANSACTION_ACTIVE: 'UQ_fiscal_notes_transaction_active',
} as const;

export const PG_UNIQUE_VIOLATION_CODE = '23505';

export const SEFAZ_CE_PARSER_VERSION = 'sefaz-ce-html-v1';
export const SEFAZ_CE_ALLOWED_HOSTS = ['nfce.sefaz.ce.gov.br'] as const;

export const FISCAL_NOTE_ALLOWED_HOSTS_BY_UF: Readonly<Record<string, readonly string[]>> = {
  [FiscalNoteSupportedUfs.CE]: SEFAZ_CE_ALLOWED_HOSTS,
};

export const SEFAZ_CE_PATHS = {
  QRCODE_V2: '/nfce/api/notasFiscal/qrcodev2/',
  QRCODE_V3: '/nfce/api/notasFiscal/qrcodev3/',
} as const;

export const SEFAZ_CE_TIMEZONE_OFFSET = '-03:00';
export const SEFAZ_CE_USER_AGENT = 'Danfy-FiscalNotes/1.0';
export const SEFAZ_CE_RETRYABLE_STATUS_CODES: readonly number[] = [502, 503, 504];
export const SEFAZ_CE_DEFAULT_UNIT = 'UN';
export const SEFAZ_CE_CONSUMER_SECTION_KEYWORD = 'consumidor';
export const SEFAZ_CE_GENERAL_INFO_SECTION_KEYWORD = 'informacoes gerais';
export const SEFAZ_CE_NAN_TEXT = 'nan';

export const SefazCeTotalLabels = {
  VALOR_TOTAL: 'valor total',
  DESCONTO: 'desconto',
  VALOR_A_PAGAR: 'valor a pagar',
  TROCO: 'troco',
  TRIBUTO: 'tributo',
} as const;

export const SefazCeStatusKeywords = {
  CANCELLED: 'cancelad',
  DENIED: 'denegad',
  HOMOLOGATION: 'homologac',
  NO_FISCAL_VALUE: 'sem valor fiscal',
} as const;

export const FISCAL_NOTE_PROVIDERS_TOKEN = Symbol('FISCAL_NOTE_PROVIDERS_TOKEN');

export const FiscalNoteMetricLabelKeys = {
  UF: 'uf',
  CHANNEL: 'channel',
  OUTCOME: 'outcome',
  RESULT: 'result',
  OPERATION: 'operation',
} as const;

export const FISCAL_NOTE_RATE_LIMIT_WINDOW_1M_SECONDS = 60;
export const FISCAL_NOTE_RATE_LIMIT_WINDOW_1H_SECONDS = 3600;
export const FISCAL_NOTE_RATE_LIMIT_MIN_RETRY_SECONDS = 1;

export const FISCAL_NOTES_HTTP_THROTTLE_LIMIT = 10;
export const FISCAL_NOTES_HTTP_THROTTLE_TTL_MS = 60_000;
export const FISCAL_NOTE_TOTAL_TOLERANCE_CENTS = 1;
export const FISCAL_NOTE_DEFAULT_RETRY_AFTER_SECONDS = 60;
export const FISCAL_NOTE_DECIMAL_MAX_INTEGER_DIGITS = 8;
export const FISCAL_NOTE_DECIMAL_MAX_FRACTION_DIGITS = 4;
export const SEFAZ_CE_MAX_RETRY_ATTEMPTS = 1;
export const FISCAL_NOTE_PROBE_LOCK_SAFETY_BUFFER_SECONDS = 5;

export function maskAccessKeyForLog(accessKey: string): string {
  const digits = accessKey.replace(/\D/g, '');
  if (digits.length < FISCAL_NOTE_UF_LENGTH + 4) {
    return '***';
  }

  return `${digits.slice(0, FISCAL_NOTE_UF_LENGTH)}***${digits.slice(-4)}`;
}
