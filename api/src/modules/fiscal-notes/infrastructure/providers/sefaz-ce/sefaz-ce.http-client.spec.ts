import { type FiscalNotesConfig } from '@/config/fiscal-notes.config';
import {
  FiscalNoteParseFailedError,
  FiscalNoteResponseTooLargeError,
  SefazTemporarilyUnavailableError,
  SefazTimeoutError,
} from '@/modules/fiscal-notes/application/errors';
import { SEFAZ_CE_PATHS } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { FiscalNoteInput } from '@/modules/fiscal-notes/domain/value-objects/fiscal-note-input.vo';
import { SefazCeHttpClient } from '@/modules/fiscal-notes/infrastructure/providers/sefaz-ce/sefaz-ce.http-client';

const VALID_CE_KEY = '23261003539462000250651030000760541443208780';

function createConfig(overrides: Partial<FiscalNotesConfig['http']> = {}): FiscalNotesConfig {
  return {
    sefazCe: {
      baseUrl: 'http://nfce.sefaz.ce.gov.br',
    },
    http: {
      timeoutMs: 1000,
      retryBackoffMs: 1,
      maxResponseBytes: 1_048_576,
      ...overrides,
    },
    cache: {
      ttlSeconds: 1200,
    },
    rateLimit: {
      userPerMinute: 5,
      userPerHour: 30,
      globalPerMinute: 40,
    },
    circuitBreaker: {
      failureThreshold: 5,
      cooldownSeconds: [60, 120, 300],
    },
  };
}

function createJsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  const bytes = new TextEncoder().encode(serialized);

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
    text: () => Promise.resolve(serialized),
  } as unknown as Response;
}

describe('SefazCeHttpClient', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('queryFiscalNote', () => {
    it('sends QR Code v2 normal payload to qrcodev2 endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ xml: '<html>ok</html>' }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(`https://evil.example/nfce?p=${VALID_CE_KEY}|2|1|1|HASH123`);

      const response = await client.queryFiscalNote(input);

      expect(response).toEqual({ xml: '<html>ok</html>' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://nfce.sefaz.ce.gov.br${SEFAZ_CE_PATHS.QRCODE_V2}`,
        expect.objectContaining({
          method: 'POST',
          redirect: 'error',
          body: JSON.stringify({
            chave_acesso: VALID_CE_KEY,
            versao_qrcode: '2',
            tipo_ambiente: '1',
            identificador_csc: '1',
            codigo_hash: 'HASH123',
          }),
        }),
      );
    });

    it('sends QR Code v2 contingency payload with dia_emissao, valor_total, and dig_val', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ xml: '<html>ok</html>' }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(`${VALID_CE_KEY}|2|1|15|4590|dGVzdGVkaWd2YWw=|1|HASHCONT`);

      await client.queryFiscalNote(input);

      expect(fetchMock).toHaveBeenCalledWith(
        `http://nfce.sefaz.ce.gov.br${SEFAZ_CE_PATHS.QRCODE_V2}`,
        expect.objectContaining({
          body: JSON.stringify({
            chave_acesso: VALID_CE_KEY,
            versao_qrcode: '2',
            tipo_ambiente: '1',
            identificador_csc: '1',
            codigo_hash: 'HASHCONT',
            dia_emissao: '15',
            valor_total: '4590',
            dig_val: 'dGVzdGVkaWd2YWw=',
          }),
        }),
      );
    });

    it('routes QR Code v2 contingency with empty digVal (contingencyDigestValue === null) to qrcodev3 endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ xml: '<html>ok</html>' }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const contingencyAccessKey = '23261103539462000250651030000832639499160820';
      const input = FiscalNoteInput.parse(
        `http://nfce.sefaz.ce.gov.br/pages/ShowNFCe.html?p=${contingencyAccessKey}|2|1|25|15.63||1|D1042A26152D9548BC455EF1DCD7C3C538B5E2D9`,
      );

      await client.queryFiscalNote(input);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://nfce.sefaz.ce.gov.br${SEFAZ_CE_PATHS.QRCODE_V3}`,
        expect.objectContaining({
          body: JSON.stringify({
            chave_acesso: contingencyAccessKey,
            versao_qrcode: '3',
            tipo_ambiente: '1',
          }),
        }),
      );
    });

    it('sends QR Code v3 / 44-digit access key payload to qrcodev3 endpoint', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({ erro: '100 - Nao encontrada' }));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      const response = await client.queryFiscalNote(input);

      expect(response).toEqual({ erro: '100 - Nao encontrada' });
      expect(fetchMock).toHaveBeenCalledWith(
        `http://nfce.sefaz.ce.gov.br${SEFAZ_CE_PATHS.QRCODE_V3}`,
        expect.objectContaining({
          body: JSON.stringify({
            chave_acesso: VALID_CE_KEY,
            versao_qrcode: '3',
            tipo_ambiente: '1',
          }),
        }),
      );
    });

    it('retries once on AbortError timeout and throws SefazTimeoutError after second failure', async () => {
      const abortError = Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      const fetchMock = jest.fn().mockRejectedValue(abortError);
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      await expect(client.queryFiscalNote(input)).rejects.toThrow(SefazTimeoutError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries once on HTTP 503 and succeeds when second attempt returns 200', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(createJsonResponse({}, 503))
        .mockResolvedValueOnce(createJsonResponse({ xml: '<html>recovered</html>' }, 200));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      const result = await client.queryFiscalNote(input);

      expect(result).toEqual({ xml: '<html>recovered</html>' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry on HTTP 400 and throws SefazTemporarilyUnavailableError', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createJsonResponse({}, 400));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      await expect(client.queryFiscalNote(input)).rejects.toThrow(SefazTemporarilyUnavailableError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('blocks immediately without retry when Content-Length exceeds maxResponseBytes', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        createJsonResponse({ xml: 'ok' }, 200, {
          'content-length': String(1_048_577),
        }),
      );
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig({ maxResponseBytes: 1_048_576 }));
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      await expect(client.queryFiscalNote(input)).rejects.toThrow(FiscalNoteResponseTooLargeError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('aborts streaming response without retry when accumulated chunks exceed maxResponseBytes', async () => {
      const cancelMock = jest.fn().mockResolvedValue(undefined);
      const releaseLockMock = jest.fn();
      const readMock = jest
        .fn()
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(600) })
        .mockResolvedValueOnce({ done: false, value: new Uint8Array(600) });

      const oversizedStreamResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        body: {
          getReader: () => ({
            read: readMock,
            cancel: cancelMock,
            releaseLock: releaseLockMock,
          }),
        },
      } as unknown as Response;

      const fetchMock = jest.fn().mockResolvedValue(oversizedStreamResponse);
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig({ maxResponseBytes: 1000 }));
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      await expect(client.queryFiscalNote(input)).rejects.toThrow(FiscalNoteResponseTooLargeError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cancelMock).toHaveBeenCalledTimes(1);
      expect(releaseLockMock).toHaveBeenCalledTimes(1);
    });

    it('throws FiscalNoteParseFailedError without retry on malformed JSON', async () => {
      const fetchMock = jest.fn().mockResolvedValue(createJsonResponse('{invalid-json', 200));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      await expect(client.queryFiscalNote(input)).rejects.toThrow(FiscalNoteParseFailedError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('retries once on network TypeError and throws SefazTemporarilyUnavailableError', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new SefazCeHttpClient(createConfig());
      const input = FiscalNoteInput.parse(VALID_CE_KEY);

      await expect(client.queryFiscalNote(input)).rejects.toThrow(SefazTemporarilyUnavailableError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
