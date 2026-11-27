import fiscalNotesConfig, { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import {
  FiscalNoteParseFailedError,
  FiscalNoteResponseTooLargeError,
  SefazTemporarilyUnavailableError,
  SefazTimeoutError,
} from '@/modules/fiscal-notes/application/errors';
import {
  FiscalNoteEnvironments,
  FiscalNoteQrVersions,
  FiscalNoteQueryChannels,
  SEFAZ_CE_MAX_RETRY_ATTEMPTS,
  SEFAZ_CE_PATHS,
  SEFAZ_CE_RETRYABLE_STATUS_CODES,
  SEFAZ_CE_USER_AGENT,
} from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { Inject, Injectable } from '@nestjs/common';

export interface SefazCeApiResponse {
  xml?: string;
  erro?: string;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
const HEADER_CONTENT_TYPE = 'Content-Type';
const HEADER_ACCEPT = 'Accept';
const HEADER_USER_AGENT = 'User-Agent';
const HEADER_CONTENT_LENGTH = 'content-length';
const APPLICATION_JSON = 'application/json';

@Injectable()
export class SefazCeHttpClient {
  private readonly baseUrl: string;

  constructor(
    @Inject(fiscalNotesConfig.KEY)
    private readonly config: FiscalNotesConfig,
  ) {
    this.baseUrl = SefazCeHttpClient.validateBaseUrl(config.sefazCe.baseUrl);
  }

  async queryFiscalNote(input: FiscalNoteInput): Promise<SefazCeApiResponse> {
    const endpointPath =
      input.channel === FiscalNoteQueryChannels.QRCODE_V2 ? SEFAZ_CE_PATHS.QRCODE_V2 : SEFAZ_CE_PATHS.QRCODE_V3;
    const url = `${this.baseUrl}${endpointPath}`;
    const payload = this.buildPayload(input);

    for (let attempt = 0; attempt <= SEFAZ_CE_MAX_RETRY_ATTEMPTS; attempt += 1) {
      const hasRetryRemaining = attempt < SEFAZ_CE_MAX_RETRY_ATTEMPTS;

      try {
        return await this.executeAttempt(url, payload);
      } catch (error: unknown) {
        if (error instanceof FiscalNoteResponseTooLargeError || error instanceof FiscalNoteParseFailedError) {
          throw error;
        }

        if (error instanceof SefazTimeoutError || error instanceof SefazTemporarilyUnavailableError) {
          if (hasRetryRemaining) {
            await this.delay(this.config.http.retryBackoffMs);
            continue;
          }

          throw error;
        }

        if (error instanceof RetryableStatusError) {
          if (hasRetryRemaining) {
            await this.delay(this.config.http.retryBackoffMs);
            continue;
          }

          throw new SefazTemporarilyUnavailableError();
        }

        if (error instanceof NonRetryableStatusError) {
          throw new SefazTemporarilyUnavailableError();
        }

        if (this.isNetworkError(error)) {
          if (hasRetryRemaining) {
            await this.delay(this.config.http.retryBackoffMs);
            continue;
          }

          throw new SefazTemporarilyUnavailableError();
        }

        throw new SefazTemporarilyUnavailableError();
      }
    }

    throw new SefazTemporarilyUnavailableError();
  }

  private async executeAttempt(url: string, payload: Record<string, unknown>): Promise<SefazCeApiResponse> {
    const controller = new AbortController();
    let timedOut = false;

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.http.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          [HEADER_CONTENT_TYPE]: APPLICATION_JSON,
          [HEADER_ACCEPT]: APPLICATION_JSON,
          [HEADER_USER_AGENT]: SEFAZ_CE_USER_AGENT,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'error',
      });

      this.assertContentLengthWithinLimit(response, controller);

      if (!response.ok) {
        await this.cancelBodyQuietly(response);

        if (SEFAZ_CE_RETRYABLE_STATUS_CODES.includes(response.status)) {
          throw new RetryableStatusError(response.status);
        }

        throw new NonRetryableStatusError(response.status);
      }

      const rawText = await this.readResponseTextWithLimit(response, controller);
      return this.parseApiResponse(rawText);
    } catch (error: unknown) {
      if (
        error instanceof FiscalNoteResponseTooLargeError ||
        error instanceof FiscalNoteParseFailedError ||
        error instanceof RetryableStatusError ||
        error instanceof NonRetryableStatusError
      ) {
        throw error;
      }

      if (timedOut || this.isAbortError(error)) {
        throw new SefazTimeoutError();
      }

      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private assertContentLengthWithinLimit(response: Response, controller: AbortController): void {
    const contentLengthRaw = response.headers.get(HEADER_CONTENT_LENGTH);
    if (!contentLengthRaw) {
      return;
    }

    const contentLength = Number(contentLengthRaw);
    if (Number.isFinite(contentLength) && contentLength > this.config.http.maxResponseBytes) {
      controller.abort();
      throw new FiscalNoteResponseTooLargeError();
    }
  }

  private async readResponseTextWithLimit(response: Response, controller: AbortController): Promise<string> {
    const maxBytes = this.config.http.maxResponseBytes;

    if (!response.body || typeof response.body.getReader !== 'function') {
      const text = await response.text();
      if (Buffer.byteLength(text, 'utf8') > maxBytes) {
        controller.abort();
        throw new FiscalNoteResponseTooLargeError();
      }

      return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let totalBytes = 0;
    const chunks: string[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel().catch(() => undefined);
            controller.abort();
            throw new FiscalNoteResponseTooLargeError();
          }

          chunks.push(decoder.decode(value, { stream: true }));
        }
      }

      chunks.push(decoder.decode());
      return chunks.join('');
    } finally {
      reader.releaseLock();
    }
  }

  private parseApiResponse(rawText: string): SefazCeApiResponse {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new FiscalNoteParseFailedError('Invalid JSON response received from SEFAZ-CE.');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new FiscalNoteParseFailedError('Unexpected JSON shape received from SEFAZ-CE.');
    }

    const record = parsed as Record<string, unknown>;
    const xml = typeof record.xml === 'string' && record.xml.trim().length > 0 ? record.xml : undefined;
    const erro = typeof record.erro === 'string' && record.erro.trim().length > 0 ? record.erro : undefined;

    if (!xml && !erro) {
      throw new FiscalNoteParseFailedError('SEFAZ-CE JSON response contained neither xml nor erro.');
    }

    return {
      ...(xml !== undefined ? { xml } : {}),
      ...(erro !== undefined ? { erro } : {}),
    };
  }

  private buildPayload(input: FiscalNoteInput): Record<string, unknown> {
    if (input.channel === FiscalNoteQueryChannels.QRCODE_V2) {
      return {
        chave_acesso: input.accessKey,
        versao_qrcode: FiscalNoteQrVersions.V2,
        tipo_ambiente: FiscalNoteEnvironments.PRODUCTION,
        identificador_csc: input.cscId,
        codigo_hash: input.qrHash,
        ...(input.isContingency
          ? {
              dia_emissao: input.contingencyIssueDay,
              valor_total: input.contingencyTotalAmount,
              dig_val: input.contingencyDigestValue,
            }
          : {}),
      };
    }

    return {
      chave_acesso: input.accessKey,
      versao_qrcode: FiscalNoteQrVersions.V3,
      tipo_ambiente: FiscalNoteEnvironments.PRODUCTION,
    };
  }

  private async cancelBodyQuietly(response: Response): Promise<void> {
    if (response.body && typeof response.body.cancel === 'function') {
      await response.body.cancel().catch(() => undefined);
    }
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private isNetworkError(error: unknown): boolean {
    return error instanceof TypeError;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms);
    });
  }

  private static validateBaseUrl(rawBaseUrl: string): string {
    const parsed = new URL(rawBaseUrl);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
      throw new Error(`Invalid SEFAZ-CE base URL protocol: ${parsed.protocol}`);
    }

    return parsed.toString().replace(/\/+$/, '');
  }
}

class RetryableStatusError extends Error {
  constructor(readonly status: number) {
    super(`Retryable SEFAZ-CE HTTP status ${status}`);
  }
}

class NonRetryableStatusError extends Error {
  constructor(readonly status: number) {
    super(`Non-retryable SEFAZ-CE HTTP status ${status}`);
  }
}
