import type { ObservabilityConfig } from '@/config/observability.config';
import {
  HEALTH_ROUTE_PREFIX,
  OBSERVABILITY_SERVICE_NAME,
  PinoLogLevels,
  REDACTED_VALUE,
  REQUEST_ID_HEADER,
} from '@/shared/observability/constants/observability.constants';
import { runWithJobLogContext, runWithRequestLogContext } from '@/shared/observability/context/observability-context';
import {
  createPinoHttpOptions,
  customLogLevel,
  observabilityMixin,
  resolveRequestId,
  sanitizeUrl,
  serializeRequest,
  serializeResponse,
} from '@/shared/observability/logging/pino-logger.config';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Writable } from 'node:stream';
import pino from 'pino';

describe('pino-logger.config', () => {
  const productionApiConfig: ObservabilityConfig = {
    logLevel: PinoLogLevels.INFO,
    nodeEnv: 'production',
    processRole: 'api',
    telegram: {
      enabled: false,
      apiBaseUrl: 'https://api.telegram.org',
      timeoutMs: 4000,
    },
    alerts: {
      cooldownSeconds: {
        critical: 900,
        warn: 1800,
      },
    },
  };

  describe('resolveRequestId', () => {
    it('reuses a valid X-Request-Id header and sets the response header', () => {
      const req = { headers: { 'x-request-id': 'client-req_123.abc' } } as unknown as IncomingMessage;
      const setHeader = jest.fn();
      const res = { setHeader, headersSent: false } as unknown as ServerResponse;

      const id = resolveRequestId(req, res);

      expect(id).toBe('client-req_123.abc');
      expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'client-req_123.abc');
    });

    it('generates a new UUID when X-Request-Id contains unsafe characters or exceeds 128 chars', () => {
      const setHeader = jest.fn();
      const res = { setHeader, headersSent: false } as unknown as ServerResponse;

      const injectedReq = { headers: { 'x-request-id': 'bad\nvalue' } } as unknown as IncomingMessage;
      const idFromInjected = resolveRequestId(injectedReq, res);
      expect(idFromInjected).toMatch(/^[0-9a-f-]{36}$/i);

      const longReq = { headers: { 'x-request-id': 'a'.repeat(129) } } as unknown as IncomingMessage;
      const idFromLong = resolveRequestId(longReq, res);
      expect(idFromLong).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('generates a UUID when X-Request-Id header is missing', () => {
      const req = { headers: {} } as unknown as IncomingMessage;
      const setHeader = jest.fn();
      const res = { setHeader, headersSent: false } as unknown as ServerResponse;

      const id = resolveRequestId(req, res);

      expect(id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
    });
  });

  describe('sanitizeUrl', () => {
    it('masks sensitive query parameters while preserving pathname and non-sensitive params', () => {
      const result = sanitizeUrl(
        '/auth/google/callback?code=secret-code&state=xyz&token=abc&p=nfce-key&hash=123&tab=1',
      );

      expect(result).toBe(
        `/auth/google/callback?code=${REDACTED_VALUE}&state=${REDACTED_VALUE}&token=${REDACTED_VALUE}&p=${REDACTED_VALUE}&hash=${REDACTED_VALUE}&tab=1`,
      );
    });

    it('returns the original pathname when there is no query string', () => {
      expect(sanitizeUrl('/transactions/123')).toBe('/transactions/123');
      expect(sanitizeUrl(undefined)).toBe('');
    });
  });

  describe('customLogLevel', () => {
    it('silences successful health probe requests and logs failing health checks', () => {
      expect(
        customLogLevel(
          { url: `${HEALTH_ROUTE_PREFIX}/liveness` } as IncomingMessage,
          { statusCode: 200 } as ServerResponse,
        ),
      ).toBe(PinoLogLevels.SILENT);
      expect(
        customLogLevel(
          { url: `${HEALTH_ROUTE_PREFIX}/readiness` } as IncomingMessage,
          { statusCode: 200 } as ServerResponse,
        ),
      ).toBe(PinoLogLevels.SILENT);
      expect(
        customLogLevel(
          { url: `${HEALTH_ROUTE_PREFIX}/readiness` } as IncomingMessage,
          { statusCode: 503 } as ServerResponse,
        ),
      ).toBe(PinoLogLevels.ERROR);
      expect(
        customLogLevel(
          { url: `${HEALTH_ROUTE_PREFIX}/liveness` } as IncomingMessage,
          { statusCode: 200 } as ServerResponse,
          new Error('boom'),
        ),
      ).toBe(PinoLogLevels.ERROR);
    });

    it('maps 2xx/3xx to info, 4xx to warn, and 5xx/errors to error', () => {
      expect(customLogLevel({ url: '/accounts' } as IncomingMessage, { statusCode: 201 } as ServerResponse)).toBe(
        PinoLogLevels.INFO,
      );
      expect(customLogLevel({ url: '/accounts' } as IncomingMessage, { statusCode: 404 } as ServerResponse)).toBe(
        PinoLogLevels.WARN,
      );
      expect(customLogLevel({ url: '/accounts' } as IncomingMessage, { statusCode: 500 } as ServerResponse)).toBe(
        PinoLogLevels.ERROR,
      );
    });
  });

  describe('serializers and redaction', () => {
    it('serializes only safe request and response fields without headers or body', () => {
      const serializedReq = serializeRequest({
        id: 'req-1',
        method: 'POST',
        originalUrl: '/auth/verify?token=top-secret',
        ip: '127.0.0.1',
        headers: { authorization: 'Bearer abc', cookie: 'session=123' },
        body: { password: 'plain' },
      } as unknown as IncomingMessage);

      expect(serializedReq).toEqual({
        id: 'req-1',
        method: 'POST',
        url: `/auth/verify?token=${REDACTED_VALUE}`,
        remoteAddress: '127.0.0.1',
      });
      expect(serializedReq).not.toHaveProperty('headers');
      expect(serializedReq).not.toHaveProperty('body');

      expect(serializeResponse({ statusCode: 204 })).toEqual({ statusCode: 204 });
    });

    it('serializes wrapped pino-http request objects preserving remoteAddress and raw.originalUrl', () => {
      const wrappedReq = {
        id: 'req-wrapped-1',
        method: 'GET',
        url: '/fallback',
        remoteAddress: '10.0.0.5',
        headers: { authorization: 'Bearer hidden' },
        raw: {
          originalUrl: '/auth/google/callback?code=secret&state=xyz&tab=1',
          ip: '127.0.0.1',
          socket: { remoteAddress: '192.168.1.1' },
        },
      } as unknown as IncomingMessage;

      const serializedReq = serializeRequest(wrappedReq);

      expect(serializedReq).toEqual({
        id: 'req-wrapped-1',
        method: 'GET',
        url: `/auth/google/callback?code=${REDACTED_VALUE}&state=${REDACTED_VALUE}&tab=1`,
        remoteAddress: '10.0.0.5',
      });
      expect(serializedReq).not.toHaveProperty('headers');
      expect(serializedReq).not.toHaveProperty('raw');
    });

    it('emits structured JSON in production with Zero-PII redaction and ALS context', () => {
      const chunks: string[] = [];
      const stream = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      const options = createPinoHttpOptions(productionApiConfig);
      const logger = pino({ ...options, serializers: undefined }, stream);

      runWithRequestLogContext('req-abc', () => {
        runWithJobLogContext({ jobId: 'job-1', queueName: 'email', jobName: 'send' }, () => {
          logger.info(
            {
              req: { headers: { authorization: 'Bearer secret', cookie: 'sid=123' } },
              res: { headers: { 'set-cookie': ['a=b'] } },
              payload: {
                password: '123',
                accessToken: 'at',
                cpf: '12345678900',
                rawHtml: '<html>secret</html>',
              },
            },
            'structured log event',
          );
        });
      });

      const parsed = JSON.parse(chunks.join('')) as Record<string, unknown>;
      expect(parsed).toMatchObject({
        level: PinoLogLevels.INFO,
        service: OBSERVABILITY_SERVICE_NAME,
        processRole: 'api',
        env: 'production',
        requestId: 'req-abc',
        jobId: 'job-1',
        queueName: 'email',
        jobName: 'send',
        msg: 'structured log event',
        req: { headers: { authorization: REDACTED_VALUE, cookie: REDACTED_VALUE } },
        res: { headers: { 'set-cookie': REDACTED_VALUE } },
        payload: {
          password: REDACTED_VALUE,
          accessToken: REDACTED_VALUE,
          cpf: REDACTED_VALUE,
          rawHtml: REDACTED_VALUE,
        },
      });
      expect(typeof parsed.time).toBe('string');
    });

    it('drops req/res headers and body through pino-http serializers in API mode', () => {
      const chunks: string[] = [];
      const stream = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk.toString());
          callback();
        },
      });

      const logger = pino(createPinoHttpOptions(productionApiConfig), stream);
      logger.info({
        req: {
          id: 'req-ser-1',
          method: 'POST',
          originalUrl: '/auth/signin?token=secret',
          headers: { authorization: 'Bearer abc' },
          body: { password: 'plain' },
        },
        res: {
          statusCode: 200,
          headers: { 'set-cookie': ['rt=xyz'] },
        },
      });

      const parsed = JSON.parse(chunks.join('')) as {
        req: Record<string, unknown>;
        res: Record<string, unknown>;
      };
      expect(parsed.req).toEqual({
        id: 'req-ser-1',
        method: 'POST',
        url: `/auth/signin?token=${REDACTED_VALUE}`,
      });
      expect(parsed.req).not.toHaveProperty('headers');
      expect(parsed.req).not.toHaveProperty('body');
      expect(parsed.res).toEqual({ statusCode: 200 });
      expect(parsed.res).not.toHaveProperty('headers');
    });

    it('configures worker options without HTTP autoLogging and configures pino-pretty in development', () => {
      const workerOptions = createPinoHttpOptions({
        ...productionApiConfig,
        processRole: 'worker',
      });
      expect(workerOptions.autoLogging).toBe(false);
      expect(workerOptions.transport).toBeUndefined();

      const devOptions = createPinoHttpOptions({
        ...productionApiConfig,
        nodeEnv: 'development',
      });
      expect(devOptions.transport).toBeDefined();
    });

    it('avoids duplicating requestId in mixin when already present in logger bindings', () => {
      runWithRequestLogContext('req-xyz', () => {
        const fakeLogger = {
          bindings: () => ({ requestId: 'req-xyz' }),
        } as unknown as pino.Logger;

        expect(observabilityMixin({}, 30, fakeLogger)).toEqual({});
      });
    });
  });
});
