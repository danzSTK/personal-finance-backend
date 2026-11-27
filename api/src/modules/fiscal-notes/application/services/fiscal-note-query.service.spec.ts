/* eslint-disable @typescript-eslint/unbound-method */
import { toDateOnly } from '@/common/utils/date-only';
import { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import {
  FiscalNoteCancelledOrDeniedError,
  FiscalNoteParseFailedError,
  FiscalNoteRateLimitExceededError,
  FiscalNoteResponseTooLargeError,
  FiscalNoteSefazNotFoundError,
  SefazTemporarilyUnavailableError,
  SefazTimeoutError,
} from '@/modules/fiscal-notes/application/errors';
import {
  IFiscalNoteCache,
  IFiscalNoteProvider,
  IFiscalNoteProviderRegistry,
  IFiscalNoteRateLimiter,
  ParsedFiscalNoteData,
} from '@/modules/fiscal-notes/application/ports';
import { FiscalNoteQueryService } from '@/modules/fiscal-notes/application/services/fiscal-note-query.service';
import {
  FISCAL_NOTE_PROBE_LOCK_SAFETY_BUFFER_SECONDS,
  FiscalNoteAlertKeys,
  FiscalNoteCacheLookupResults,
  FiscalNoteLogEvents,
  FiscalNoteMetricNames,
  FiscalNoteQueryChannels,
  FiscalNoteQueryOutcomes,
  FiscalNoteSupportedUfs,
  SEFAZ_CE_MAX_RETRY_ATTEMPTS,
  SEFAZ_CE_PARSER_VERSION,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { CircuitBreakerService, CircuitBreakerStates } from '@/shared/circuit-breaker';
import { type IMetricsRecorder, OperationalAlertService, OperationalAlertSeverities } from '@/shared/observability';
import { Logger } from '@nestjs/common';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function buildParsed(): ParsedFiscalNoteData {
  return {
    accessKey: VALID_CE_KEY,
    sourceUf: '23',
    number: '76054',
    series: '103',
    issuedAt: new Date('2026-10-16T01:15:30.000Z'),
    issuedDate: toDateOnly('2026-10-15'),
    protocol: '223260123456789',
    issuerName: 'SUPERMERCADO EXEMPLO',
    issuerCnpj: '03539462000250',
    issuerAddress: 'Fortaleza, CE',
    grossAmountCents: 4013,
    discountAmountCents: 872,
    payableAmountCents: 3141,
    taxAmountCents: 1051,
    changeAmountCents: null,
    xmlVersion: '4.00',
    xsltVersion: '2.05',
    parserVersion: SEFAZ_CE_PARSER_VERSION,
    items: [
      {
        position: 1,
        rawDescription: 'CAFE',
        storeCode: '1',
        unit: 'UN',
        quantity: 1,
        unitPrice: 31.41,
        totalPriceCents: 3141,
      },
    ],
    payments: [{ position: 1, methodLabel: 'PIX', amountCents: 3141 }],
  };
}

describe('FiscalNoteQueryService', () => {
  const userId = '11111111-1111-4111-a111-111111111111';
  const config = {
    http: {
      timeoutMs: 7000,
      retryBackoffMs: 400,
      maxResponseBytes: 1_048_576,
    },
    circuitBreaker: {
      failureThreshold: 5,
      cooldownSeconds: [60, 120, 300],
    },
  } as unknown as FiscalNotesConfig;

  let cache: jest.Mocked<IFiscalNoteCache>;
  let provider: jest.Mocked<IFiscalNoteProvider>;
  let registry: jest.Mocked<IFiscalNoteProviderRegistry>;
  let circuitBreaker: jest.Mocked<CircuitBreakerService>;
  let rateLimiter: jest.Mocked<IFiscalNoteRateLimiter>;
  let metrics: jest.Mocked<IMetricsRecorder>;
  let alerts: jest.Mocked<Pick<OperationalAlertService, 'notify'>>;
  let service: FiscalNoteQueryService;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };
    provider = {
      uf: '23',
      fetchAndParse: jest.fn(),
    };
    registry = {
      getProvider: jest.fn().mockReturnValue(provider),
      isSupported: jest.fn().mockReturnValue(true),
    };
    circuitBreaker = {
      canExecute: jest.fn().mockResolvedValue({ allowed: true, state: CircuitBreakerStates.CLOSED }),
      recordSuccess: jest.fn().mockResolvedValue({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: false,
      }),
      recordFailure: jest.fn().mockResolvedValue({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.CLOSED,
        opened: false,
        consecutiveFailures: 1,
        cooldownStage: 0,
      }),
    } as unknown as jest.Mocked<CircuitBreakerService>;
    rateLimiter = {
      consumeSefazQuota: jest.fn().mockResolvedValue(undefined),
    };
    metrics = {
      incrementCounter: jest.fn(),
      observeDuration: jest.fn(),
    };
    alerts = {
      notify: jest.fn(),
    };

    service = new FiscalNoteQueryService(
      cache,
      registry,
      circuitBreaker,
      rateLimiter,
      config,
      metrics,
      alerts as unknown as OperationalAlertService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolve', () => {
    it('logs warning and emits WARN alert keyed by UF for distinct unknown QR hosts while preserving host metadata', async () => {
      const parsed = buildParsed();
      cache.get.mockResolvedValue(parsed);

      const firstResult = await service.resolve(`https://unknown.qr.example/nfce?p=${VALID_CE_KEY}|2|1|1|HASH`, userId);
      const secondResult = await service.resolve(
        `https://other-unknown.qr.example/nfce?p=${VALID_CE_KEY}|2|1|1|HASH`,
        userId,
      );

      expect(firstResult.cacheHit).toBe(true);
      expect(secondResult.cacheHit).toBe(true);
      expect(warnSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          event: FiscalNoteLogEvents.FISCAL_NOTE_UNKNOWN_QR_HOST,
          uf: FiscalNoteSupportedUfs.CE,
          host: 'unknown.qr.example',
        }),
      );
      expect(warnSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          event: FiscalNoteLogEvents.FISCAL_NOTE_UNKNOWN_QR_HOST,
          uf: FiscalNoteSupportedUfs.CE,
          host: 'other-unknown.qr.example',
        }),
      );
      expect(alerts.notify).toHaveBeenCalledTimes(2);
      expect(alerts.notify.mock.calls[0]?.[0]).toMatchObject({
        alertKey: FiscalNoteAlertKeys.unknownQrHost(FiscalNoteSupportedUfs.CE),
        severity: OperationalAlertSeverities.WARN,
        metadata: {
          uf: FiscalNoteSupportedUfs.CE,
          host: 'unknown.qr.example',
        },
      });
      expect(alerts.notify.mock.calls[1]?.[0]).toMatchObject({
        alertKey: FiscalNoteAlertKeys.unknownQrHost(FiscalNoteSupportedUfs.CE),
        severity: OperationalAlertSeverities.WARN,
        metadata: {
          uf: FiscalNoteSupportedUfs.CE,
          host: 'other-unknown.qr.example',
        },
      });
    });

    it('sizes CircuitBreaker probeLockTtlSeconds from http timeout, retry backoff, and safety buffer', async () => {
      const parsed = buildParsed();
      cache.get.mockResolvedValue(null);
      provider.fetchAndParse.mockResolvedValue(parsed);

      await service.resolve(VALID_CE_KEY, userId);

      const expectedDefaultTtl =
        Math.ceil(
          (config.http.timeoutMs * (SEFAZ_CE_MAX_RETRY_ATTEMPTS + 1) +
            config.http.retryBackoffMs * SEFAZ_CE_MAX_RETRY_ATTEMPTS) /
            1_000,
        ) + FISCAL_NOTE_PROBE_LOCK_SAFETY_BUFFER_SECONDS;
      expect(circuitBreaker.canExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          probeLockTtlSeconds: expectedDefaultTtl,
        }),
      );

      const worstCaseConfig = {
        http: {
          timeoutMs: 15_000,
          retryBackoffMs: 3_000,
          maxResponseBytes: 1_048_576,
        },
        circuitBreaker: config.circuitBreaker,
      } as unknown as FiscalNotesConfig;
      const worstCaseService = new FiscalNoteQueryService(
        cache,
        registry,
        circuitBreaker,
        rateLimiter,
        worstCaseConfig,
        metrics,
        alerts as unknown as OperationalAlertService,
      );

      await worstCaseService.resolve(VALID_CE_KEY, userId);

      const worstCaseCall = circuitBreaker.canExecute.mock.calls.at(-1)?.[0];
      expect(worstCaseCall?.probeLockTtlSeconds).toBe(38);
      expect(worstCaseCall?.probeLockTtlSeconds).toBeGreaterThanOrEqual(33);
    });

    it('returns cache hit without consulting CircuitBreaker, RateLimiter, or Provider', async () => {
      const parsed = buildParsed();
      cache.get.mockResolvedValue(parsed);

      const result = await service.resolve(VALID_CE_KEY, userId);

      expect(result).toMatchObject({ parsed, cacheHit: true });
      expect(circuitBreaker.canExecute).not.toHaveBeenCalled();
      expect(rateLimiter.consumeSefazQuota).not.toHaveBeenCalled();
      expect(provider.fetchAndParse).not.toHaveBeenCalled();
      expect(metrics.incrementCounter).toHaveBeenCalledWith(FiscalNoteMetricNames.CACHE_LOOKUP_TOTAL, {
        uf: '23',
        result: FiscalNoteCacheLookupResults.HIT,
      });
    });

    it('fails fast when CircuitBreaker is OPEN', async () => {
      cache.get.mockResolvedValue(null);
      circuitBreaker.canExecute.mockResolvedValue({
        allowed: false,
        state: CircuitBreakerStates.OPEN,
        retryAfterSeconds: 45,
      });

      const promise = service.resolve(VALID_CE_KEY, userId);
      await expect(promise).rejects.toThrow(SefazTemporarilyUnavailableError);
      await expect(promise).rejects.toMatchObject({ retryAfterSeconds: 45 });

      expect(rateLimiter.consumeSefazQuota).not.toHaveBeenCalled();
      expect(provider.fetchAndParse).not.toHaveBeenCalled();
      expect(metrics.incrementCounter).toHaveBeenCalledWith(FiscalNoteMetricNames.SEFAZ_QUERY_TOTAL, {
        uf: '23',
        channel: FiscalNoteQueryChannels.QRCODE_V3,
        outcome: FiscalNoteQueryOutcomes.CB_OPEN,
      });
    });

    it('propagates rate limit errors without recording CircuitBreaker failure', async () => {
      cache.get.mockResolvedValue(null);
      rateLimiter.consumeSefazQuota.mockRejectedValue(new FiscalNoteRateLimitExceededError(20));

      await expect(service.resolve(VALID_CE_KEY, userId)).rejects.toThrow(FiscalNoteRateLimitExceededError);
      expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
      expect(metrics.incrementCounter).toHaveBeenCalledWith(FiscalNoteMetricNames.SEFAZ_QUERY_TOTAL, {
        uf: '23',
        channel: FiscalNoteQueryChannels.QRCODE_V3,
        outcome: FiscalNoteQueryOutcomes.RATE_LIMITED,
      });
    });

    it('caches parsed note, records metrics, and sends RESOLVED alert when HALF_OPEN closes', async () => {
      const parsed = buildParsed();
      cache.get.mockResolvedValue(null);
      provider.fetchAndParse.mockResolvedValue(parsed);
      circuitBreaker.recordSuccess.mockResolvedValue({
        previousState: CircuitBreakerStates.HALF_OPEN,
        currentState: CircuitBreakerStates.CLOSED,
        closedFromHalfOpen: true,
      });

      const result = await service.resolve(VALID_CE_KEY, userId);

      expect(result.cacheHit).toBe(false);
      expect(result.parsed).toBe(parsed);
      expect(cache.set).toHaveBeenCalledWith(VALID_CE_KEY, parsed);
      expect(alerts.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey: FiscalNoteAlertKeys.sefazCircuitBreaker('23'),
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_CLOSED,
          severity: OperationalAlertSeverities.RESOLVED,
        }),
      );
      expect(metrics.observeDuration).toHaveBeenCalledWith(
        FiscalNoteMetricNames.SEFAZ_QUERY_DURATION_MS,
        expect.any(Number),
        expect.objectContaining({ outcome: FiscalNoteQueryOutcomes.SUCCESS }),
      );
    });

    it('does not record CircuitBreaker failure for SEFAZ business errors and releases HALF_OPEN probe', async () => {
      cache.get.mockResolvedValue(null);
      circuitBreaker.canExecute.mockResolvedValue({
        allowed: true,
        state: CircuitBreakerStates.HALF_OPEN,
      });
      provider.fetchAndParse.mockRejectedValue(new FiscalNoteSefazNotFoundError());

      await expect(service.resolve(VALID_CE_KEY, userId)).rejects.toThrow(FiscalNoteSefazNotFoundError);
      expect(circuitBreaker.recordFailure).not.toHaveBeenCalled();
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledTimes(1);

      provider.fetchAndParse.mockRejectedValueOnce(new FiscalNoteCancelledOrDeniedError());
      await expect(service.resolve(VALID_CE_KEY, userId)).rejects.toThrow(FiscalNoteCancelledOrDeniedError);
    });

    it('records failure and sends CRITICAL parser and CB alerts on FiscalNoteParseFailedError', async () => {
      cache.get.mockResolvedValue(null);
      provider.fetchAndParse.mockRejectedValue(new FiscalNoteParseFailedError('Layout mismatch'));
      circuitBreaker.recordFailure.mockResolvedValue({
        previousState: CircuitBreakerStates.CLOSED,
        currentState: CircuitBreakerStates.OPEN,
        opened: true,
        retryAfterSeconds: 60,
        consecutiveFailures: 5,
        cooldownStage: 0,
      });

      await expect(service.resolve(VALID_CE_KEY, userId)).rejects.toThrow(FiscalNoteParseFailedError);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_PARSER_FAILURE,
          accessKeyMasked: '23***8780',
        }),
      );
      expect(alerts.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey: FiscalNoteAlertKeys.sefazParserFailure('23'),
          severity: OperationalAlertSeverities.CRITICAL,
        }),
      );
      expect(alerts.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey: FiscalNoteAlertKeys.sefazCircuitBreaker('23'),
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_OPENED,
          severity: OperationalAlertSeverities.CRITICAL,
        }),
      );
    });

    it('records failure and classifies timeout and response_too_large outcomes', async () => {
      cache.get.mockResolvedValue(null);
      provider.fetchAndParse.mockRejectedValueOnce(new SefazTimeoutError());

      await expect(service.resolve(VALID_CE_KEY, userId)).rejects.toThrow(SefazTimeoutError);
      expect(metrics.incrementCounter).toHaveBeenCalledWith(
        FiscalNoteMetricNames.SEFAZ_QUERY_TOTAL,
        expect.objectContaining({ outcome: FiscalNoteQueryOutcomes.TIMEOUT }),
      );

      provider.fetchAndParse.mockRejectedValueOnce(new FiscalNoteResponseTooLargeError());
      await expect(service.resolve(VALID_CE_KEY, userId)).rejects.toThrow(FiscalNoteResponseTooLargeError);
      expect(metrics.incrementCounter).toHaveBeenCalledWith(
        FiscalNoteMetricNames.SEFAZ_QUERY_TOTAL,
        expect.objectContaining({ outcome: FiscalNoteQueryOutcomes.RESPONSE_TOO_LARGE }),
      );
    });
  });
});
