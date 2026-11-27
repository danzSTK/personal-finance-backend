import { CacheKeys } from '@/common/utils/cache-keys.factory';
import fiscalNotesConfig, { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import {
  FiscalNoteCancelledOrDeniedError,
  FiscalNoteParseFailedError,
  FiscalNoteResponseTooLargeError,
  FiscalNoteSefazNotFoundError,
  SefazTemporarilyUnavailableError,
  SefazTimeoutError,
} from '@/modules/fiscal-notes/application/errors';
import {
  IFiscalNoteCache,
  IFiscalNoteProviderRegistry,
  IFiscalNoteRateLimiter,
  ParsedFiscalNoteData,
} from '@/modules/fiscal-notes/application/ports';
import {
  FISCAL_NOTE_PROBE_LOCK_SAFETY_BUFFER_SECONDS,
  FiscalNoteAlertKeys,
  FiscalNoteCacheLookupResults,
  FiscalNoteLogEvents,
  FiscalNoteMetricLabelKeys,
  FiscalNoteMetricNames,
  FiscalNoteQueryOutcome,
  FiscalNoteQueryOutcomes,
  SEFAZ_CE_MAX_RETRY_ATTEMPTS,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import {
  FiscalNoteHomologationNotAllowedError,
  FiscalNoteUnsupportedUfError,
} from '@/modules/fiscal-notes/domain/errors';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { CircuitBreakerService, CircuitBreakerStates } from '@/shared/circuit-breaker';
import {
  type IMetricsRecorder,
  METRICS_RECORDER,
  OperationalAlertService,
  OperationalAlertSeverities,
} from '@/shared/observability';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

export interface ResolvedFiscalNoteQuery {
  input: FiscalNoteInput;
  parsed: ParsedFiscalNoteData;
  cacheHit: boolean;
}

@Injectable()
export class FiscalNoteQueryService {
  private readonly logger = new Logger(FiscalNoteQueryService.name);

  constructor(
    private readonly cache: IFiscalNoteCache,
    private readonly providerRegistry: IFiscalNoteProviderRegistry,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly rateLimiter: IFiscalNoteRateLimiter,
    @Inject(fiscalNotesConfig.KEY)
    private readonly config: FiscalNotesConfig,
    @Optional()
    @Inject(METRICS_RECORDER)
    private readonly metricsRecorder?: IMetricsRecorder,
    @Optional()
    private readonly operationalAlertService?: OperationalAlertService,
  ) {}

  async resolve(rawInput: string, userId: string): Promise<ResolvedFiscalNoteQuery> {
    const input = FiscalNoteInput.parse(rawInput);

    if (input.unknownQrHost !== null) {
      this.logger.warn({
        event: FiscalNoteLogEvents.FISCAL_NOTE_UNKNOWN_QR_HOST,
        uf: input.uf,
        channel: input.channel,
        host: input.unknownQrHost,
        accessKeyMasked: input.maskedAccessKey,
      });

      this.operationalAlertService?.notify({
        alertKey: FiscalNoteAlertKeys.unknownQrHost(input.uf),
        event: FiscalNoteLogEvents.FISCAL_NOTE_UNKNOWN_QR_HOST,
        severity: OperationalAlertSeverities.WARN,
        title: 'QR Code de NFC-e com host fora da allowlist',
        summary: `Host desconhecido "${input.unknownQrHost}" detectado no parâmetro de entrada; requisição externa bloqueada.`,
        metadata: {
          uf: input.uf,
          channel: input.channel,
          host: input.unknownQrHost,
        },
      });
    }

    const cached = await this.cache.get(input.accessKey);
    if (cached) {
      this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.CACHE_LOOKUP_TOTAL, {
        [FiscalNoteMetricLabelKeys.UF]: input.uf,
        [FiscalNoteMetricLabelKeys.RESULT]: FiscalNoteCacheLookupResults.HIT,
      });

      return {
        input,
        parsed: cached,
        cacheHit: true,
      };
    }

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.CACHE_LOOKUP_TOTAL, {
      [FiscalNoteMetricLabelKeys.UF]: input.uf,
      [FiscalNoteMetricLabelKeys.RESULT]: FiscalNoteCacheLookupResults.MISS,
    });

    const provider = this.providerRegistry.getProvider(input.uf);
    if (!provider) {
      throw new FiscalNoteUnsupportedUfError(input.uf);
    }

    const maxRequestWindowMs =
      this.config.http.timeoutMs * (SEFAZ_CE_MAX_RETRY_ATTEMPTS + 1) +
      this.config.http.retryBackoffMs * SEFAZ_CE_MAX_RETRY_ATTEMPTS;
    const probeLockTtlSeconds = Math.ceil(maxRequestWindowMs / 1_000) + FISCAL_NOTE_PROBE_LOCK_SAFETY_BUFFER_SECONDS;

    const cbOptions = {
      key: CacheKeys.fiscalNotes.circuitBreaker(input.uf),
      failureThreshold: this.config.circuitBreaker.failureThreshold,
      cooldownSeconds: this.config.circuitBreaker.cooldownSeconds,
      probeLockTtlSeconds,
    };

    const decision = await this.circuitBreaker.canExecute(cbOptions);
    if (!decision.allowed) {
      this.recordQueryCounter(input, FiscalNoteQueryOutcomes.CB_OPEN);
      throw new SefazTemporarilyUnavailableError(decision.retryAfterSeconds);
    }

    try {
      await this.rateLimiter.consumeSefazQuota({ userId, uf: input.uf });
    } catch (error: unknown) {
      if (decision.state === CircuitBreakerStates.HALF_OPEN) {
        await this.circuitBreaker.releaseProbe(cbOptions);
      }
      this.recordQueryCounter(input, FiscalNoteQueryOutcomes.RATE_LIMITED);
      throw error;
    }

    const startedAt = performance.now();

    try {
      const parsed = await provider.fetchAndParse(input);
      const durationMs = performance.now() - startedAt;

      const cbSuccess = await this.circuitBreaker.recordSuccess(cbOptions);
      if (cbSuccess.closedFromHalfOpen) {
        this.notifyCircuitBreakerClosed(input.uf, cbSuccess.previousState);
      }

      await this.cache.set(input.accessKey, parsed);
      this.recordQueryMetrics(input, FiscalNoteQueryOutcomes.SUCCESS, durationMs);

      return {
        input,
        parsed,
        cacheHit: false,
      };
    } catch (error: unknown) {
      const durationMs = performance.now() - startedAt;

      if (this.isSefazBusinessError(error)) {
        if (decision.state === CircuitBreakerStates.HALF_OPEN) {
          const cbSuccess = await this.circuitBreaker.recordSuccess(cbOptions);
          if (cbSuccess.closedFromHalfOpen) {
            this.notifyCircuitBreakerClosed(input.uf, cbSuccess.previousState);
          }
        }

        this.recordQueryMetrics(input, FiscalNoteQueryOutcomes.BUSINESS_ERROR, durationMs);
        throw error;
      }

      if (error instanceof FiscalNoteParseFailedError) {
        const cbFailure = await this.circuitBreaker.recordFailure(cbOptions);

        this.logger.error({
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_PARSER_FAILURE,
          uf: input.uf,
          channel: input.channel,
          accessKeyMasked: input.maskedAccessKey,
          errorMessage: error.message,
        });

        this.operationalAlertService?.notify({
          alertKey: FiscalNoteAlertKeys.sefazParserFailure(input.uf),
          event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_PARSER_FAILURE,
          severity: OperationalAlertSeverities.CRITICAL,
          title: `Falha estrutural no parser SEFAZ (UF ${input.uf})`,
          summary: 'A resposta HTML da SEFAZ falhou no parsing ou validação de integridade.',
          metadata: {
            uf: input.uf,
            channel: input.channel,
          },
        });

        if (cbFailure.opened) {
          this.notifyCircuitBreakerOpened(
            input.uf,
            cbFailure.consecutiveFailures,
            cbFailure.cooldownStage,
            cbFailure.retryAfterSeconds,
          );
        }

        this.recordQueryMetrics(input, FiscalNoteQueryOutcomes.PARSE_ERROR, durationMs);
        throw error;
      }

      const outcome = this.classifyInfraOutcome(error);
      const cbFailure = await this.circuitBreaker.recordFailure(cbOptions);

      this.logger.warn({
        event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_REQUEST_FAILED,
        uf: input.uf,
        channel: input.channel,
        outcome,
        accessKeyMasked: input.maskedAccessKey,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      if (cbFailure.opened) {
        this.notifyCircuitBreakerOpened(
          input.uf,
          cbFailure.consecutiveFailures,
          cbFailure.cooldownStage,
          cbFailure.retryAfterSeconds,
        );
      }

      this.recordQueryMetrics(input, outcome, durationMs);

      if (
        error instanceof SefazTimeoutError ||
        error instanceof SefazTemporarilyUnavailableError ||
        error instanceof FiscalNoteResponseTooLargeError
      ) {
        throw error;
      }

      throw new SefazTemporarilyUnavailableError();
    }
  }

  private isSefazBusinessError(error: unknown): boolean {
    return (
      error instanceof FiscalNoteSefazNotFoundError ||
      error instanceof FiscalNoteCancelledOrDeniedError ||
      error instanceof FiscalNoteHomologationNotAllowedError
    );
  }

  private classifyInfraOutcome(error: unknown): FiscalNoteQueryOutcome {
    if (error instanceof SefazTimeoutError) {
      return FiscalNoteQueryOutcomes.TIMEOUT;
    }

    if (error instanceof FiscalNoteResponseTooLargeError) {
      return FiscalNoteQueryOutcomes.RESPONSE_TOO_LARGE;
    }

    return FiscalNoteQueryOutcomes.NETWORK_ERROR;
  }

  private notifyCircuitBreakerOpened(
    uf: string,
    consecutiveFailures: number,
    cooldownStage: number,
    retryAfterSeconds?: number,
  ): void {
    this.logger.warn({
      event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_OPENED,
      uf,
      consecutiveFailures,
      cooldownStage,
      retryAfterSeconds,
    });

    this.operationalAlertService?.notify({
      alertKey: FiscalNoteAlertKeys.sefazCircuitBreaker(uf),
      event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_OPENED,
      severity: OperationalAlertSeverities.CRITICAL,
      title: `Circuit breaker aberto para SEFAZ (UF ${uf})`,
      summary: `Consultas à SEFAZ (UF ${uf}) foram temporariamente interrompidas após ${consecutiveFailures} falhas consecutivas.`,
      metadata: {
        uf,
        consecutiveFailures,
        cooldownStage,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
    });
  }

  private notifyCircuitBreakerClosed(uf: string, previousState: string): void {
    this.logger.log({
      event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_CLOSED,
      uf,
      previousState,
    });

    this.operationalAlertService?.notify({
      alertKey: FiscalNoteAlertKeys.sefazCircuitBreaker(uf),
      event: FiscalNoteLogEvents.FISCAL_NOTE_SEFAZ_CB_CLOSED,
      severity: OperationalAlertSeverities.RESOLVED,
      title: `Circuit breaker fechado para SEFAZ (UF ${uf})`,
      summary: `Integração com a SEFAZ (UF ${uf}) recuperada e operando normalmente.`,
      metadata: {
        uf,
        previousState,
      },
    });
  }

  private recordQueryCounter(input: FiscalNoteInput, outcome: FiscalNoteQueryOutcome): void {
    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.SEFAZ_QUERY_TOTAL, {
      [FiscalNoteMetricLabelKeys.UF]: input.uf,
      [FiscalNoteMetricLabelKeys.CHANNEL]: input.channel,
      [FiscalNoteMetricLabelKeys.OUTCOME]: outcome,
    });
  }

  private recordQueryMetrics(input: FiscalNoteInput, outcome: FiscalNoteQueryOutcome, durationMs: number): void {
    const labels = {
      [FiscalNoteMetricLabelKeys.UF]: input.uf,
      [FiscalNoteMetricLabelKeys.CHANNEL]: input.channel,
      [FiscalNoteMetricLabelKeys.OUTCOME]: outcome,
    };

    this.metricsRecorder?.incrementCounter(FiscalNoteMetricNames.SEFAZ_QUERY_TOTAL, labels);
    this.metricsRecorder?.observeDuration(FiscalNoteMetricNames.SEFAZ_QUERY_DURATION_MS, durationMs, labels);
  }
}
