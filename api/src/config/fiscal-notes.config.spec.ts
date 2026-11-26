import Joi from 'joi';
import fiscalNotesConfig, {
  DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS,
  DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS,
  DEFAULT_FISCAL_NOTES_CB_FAILURE_THRESHOLD,
  DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
  DEFAULT_FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS,
  DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
  DEFAULT_FISCAL_NOTES_RL_GLOBAL_PER_MINUTE,
  DEFAULT_FISCAL_NOTES_RL_USER_PER_HOUR,
  DEFAULT_FISCAL_NOTES_RL_USER_PER_MINUTE,
  DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL,
  fiscalNotesEnvSchema,
  parseFiscalNotesCooldownSecondsCsv,
} from './fiscal-notes.config';

describe('fiscalNotesConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.FISCAL_NOTES_SEFAZ_CE_BASE_URL;
    delete process.env.FISCAL_NOTES_HTTP_TIMEOUT_MS;
    delete process.env.FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS;
    delete process.env.FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES;
    delete process.env.FISCAL_NOTES_CACHE_TTL_SECONDS;
    delete process.env.FISCAL_NOTES_RL_USER_PER_MINUTE;
    delete process.env.FISCAL_NOTES_RL_USER_PER_HOUR;
    delete process.env.FISCAL_NOTES_RL_GLOBAL_PER_MINUTE;
    delete process.env.FISCAL_NOTES_CB_FAILURE_THRESHOLD;
    delete process.env.FISCAL_NOTES_CB_COOLDOWN_SECONDS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('defaults', () => {
    it('returns safe defaults when environment variables are absent', () => {
      const config = fiscalNotesConfig();

      expect(config).toEqual({
        sefazCe: {
          baseUrl: DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL,
        },
        http: {
          timeoutMs: DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
          retryBackoffMs: DEFAULT_FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS,
          maxResponseBytes: DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
        },
        cache: {
          ttlSeconds: DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS,
        },
        rateLimit: {
          userPerMinute: DEFAULT_FISCAL_NOTES_RL_USER_PER_MINUTE,
          userPerHour: DEFAULT_FISCAL_NOTES_RL_USER_PER_HOUR,
          globalPerMinute: DEFAULT_FISCAL_NOTES_RL_GLOBAL_PER_MINUTE,
        },
        circuitBreaker: {
          failureThreshold: DEFAULT_FISCAL_NOTES_CB_FAILURE_THRESHOLD,
          cooldownSeconds: [...DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS],
        },
      });
    });
  });

  describe('environment values', () => {
    it('reads custom values and normalizes baseUrl and CSV cooldown list', () => {
      process.env.FISCAL_NOTES_SEFAZ_CE_BASE_URL = 'https://nfce.sefaz.ce.gov.br///';
      process.env.FISCAL_NOTES_HTTP_TIMEOUT_MS = '8000';
      process.env.FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS = '500';
      process.env.FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES = '2097152';
      process.env.FISCAL_NOTES_CACHE_TTL_SECONDS = '1800';
      process.env.FISCAL_NOTES_RL_USER_PER_MINUTE = '8';
      process.env.FISCAL_NOTES_RL_USER_PER_HOUR = '60';
      process.env.FISCAL_NOTES_RL_GLOBAL_PER_MINUTE = '80';
      process.env.FISCAL_NOTES_CB_FAILURE_THRESHOLD = '3';
      process.env.FISCAL_NOTES_CB_COOLDOWN_SECONDS = ' 30, 90 , 180 ';

      const config = fiscalNotesConfig();

      expect(config).toEqual({
        sefazCe: {
          baseUrl: 'https://nfce.sefaz.ce.gov.br',
        },
        http: {
          timeoutMs: 8000,
          retryBackoffMs: 500,
          maxResponseBytes: 2_097_152,
        },
        cache: {
          ttlSeconds: 1800,
        },
        rateLimit: {
          userPerMinute: 8,
          userPerHour: 60,
          globalPerMinute: 80,
        },
        circuitBreaker: {
          failureThreshold: 3,
          cooldownSeconds: [30, 90, 180],
        },
      });
    });

    it('falls back to defaults when optional values are blank or invalid CSV cooldown is provided', () => {
      process.env.FISCAL_NOTES_SEFAZ_CE_BASE_URL = '   ';
      process.env.FISCAL_NOTES_HTTP_TIMEOUT_MS = '   ';
      process.env.FISCAL_NOTES_CB_COOLDOWN_SECONDS = '60,4,120';

      const config = fiscalNotesConfig();

      expect(config.sefazCe.baseUrl).toBe(DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL);
      expect(config.http.timeoutMs).toBe(DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS);
      expect(config.circuitBreaker.cooldownSeconds).toEqual([...DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS]);
    });
  });

  describe('parseFiscalNotesCooldownSecondsCsv', () => {
    it('parses valid comma-separated positive integers >= 5', () => {
      expect(parseFiscalNotesCooldownSecondsCsv('5, 60, 120, 300')).toEqual([5, 60, 120, 300]);
    });

    it('returns null for empty, non-integer, negative, or values below 5', () => {
      expect(parseFiscalNotesCooldownSecondsCsv('')).toBeNull();
      expect(parseFiscalNotesCooldownSecondsCsv('   ')).toBeNull();
      expect(parseFiscalNotesCooldownSecondsCsv('60,,120')).toBeNull();
      expect(parseFiscalNotesCooldownSecondsCsv('60,abc')).toBeNull();
      expect(parseFiscalNotesCooldownSecondsCsv('60,12.5')).toBeNull();
      expect(parseFiscalNotesCooldownSecondsCsv('60,4')).toBeNull();
      expect(parseFiscalNotesCooldownSecondsCsv('-10,60')).toBeNull();
    });
  });

  describe('fiscalNotesEnvSchema', () => {
    const schema = Joi.object(fiscalNotesEnvSchema);

    it('applies safe defaults when all optional variables are omitted', () => {
      const result = schema.validate({});

      expect(result.error).toBeUndefined();
      expect(result.value).toEqual({
        FISCAL_NOTES_SEFAZ_CE_BASE_URL: DEFAULT_FISCAL_NOTES_SEFAZ_CE_BASE_URL,
        FISCAL_NOTES_HTTP_TIMEOUT_MS: DEFAULT_FISCAL_NOTES_HTTP_TIMEOUT_MS,
        FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS: DEFAULT_FISCAL_NOTES_HTTP_RETRY_BACKOFF_MS,
        FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES: DEFAULT_FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES,
        FISCAL_NOTES_CACHE_TTL_SECONDS: DEFAULT_FISCAL_NOTES_CACHE_TTL_SECONDS,
        FISCAL_NOTES_RL_USER_PER_MINUTE: DEFAULT_FISCAL_NOTES_RL_USER_PER_MINUTE,
        FISCAL_NOTES_RL_USER_PER_HOUR: DEFAULT_FISCAL_NOTES_RL_USER_PER_HOUR,
        FISCAL_NOTES_RL_GLOBAL_PER_MINUTE: DEFAULT_FISCAL_NOTES_RL_GLOBAL_PER_MINUTE,
        FISCAL_NOTES_CB_FAILURE_THRESHOLD: DEFAULT_FISCAL_NOTES_CB_FAILURE_THRESHOLD,
        FISCAL_NOTES_CB_COOLDOWN_SECONDS: DEFAULT_FISCAL_NOTES_CB_COOLDOWN_SECONDS.join(','),
      });
    });

    it.each(['60,4,120', '60,abc', '60,,120', '0,60'])('rejects invalid CSV cooldown list %p', invalidCsv => {
      const result = schema.validate({
        FISCAL_NOTES_CB_COOLDOWN_SECONDS: invalidCsv,
      });

      expect(result.error?.message).toContain('FISCAL_NOTES_CB_COOLDOWN_SECONDS');
    });

    it('rejects out-of-range numeric bounds and unsupported URL schemes', () => {
      const result = schema.validate(
        {
          FISCAL_NOTES_SEFAZ_CE_BASE_URL: 'ftp://nfce.sefaz.ce.gov.br',
          FISCAL_NOTES_HTTP_TIMEOUT_MS: '500',
          FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES: '1024',
        },
        { abortEarly: false },
      );

      expect(result.error?.details.map(detail => detail.path[0])).toEqual(
        expect.arrayContaining([
          'FISCAL_NOTES_SEFAZ_CE_BASE_URL',
          'FISCAL_NOTES_HTTP_TIMEOUT_MS',
          'FISCAL_NOTES_HTTP_MAX_RESPONSE_BYTES',
        ]),
      );
    });
  });
});
