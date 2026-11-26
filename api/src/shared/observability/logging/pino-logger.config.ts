import { ProcessRoles } from '@/common/models/constants/process-role.constants';
import { AppStatus } from '@/common/models/enums';
import { ObservabilityConfig } from '@/config/observability.config';
import {
  HEALTH_ROUTE_PREFIX,
  MAX_REQUEST_ID_LENGTH,
  OBSERVABILITY_SERVICE_NAME,
  PINO_REDACT_PATHS,
  PinoLogLevels,
  REDACTED_VALUE,
  REQUEST_ID_HEADER,
  REQUEST_ID_HEADER_LOWER,
  REQUEST_ID_PATTERN,
  SENSITIVE_QUERY_PARAMS,
} from '@/shared/observability/constants/observability.constants';
import { getObservabilityContext } from '@/shared/observability/context/observability-context';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import pino from 'pino';
import { Options } from 'pino-http';

type RawRequestLike = IncomingMessage & {
  originalUrl?: string;
  ip?: string;
};

type RequestLike = IncomingMessage & {
  id?: unknown;
  originalUrl?: string;
  ip?: string;
  remoteAddress?: string;
  raw?: RawRequestLike;
};

type ResponseLike = Pick<ServerResponse, 'setHeader' | 'headersSent' | 'statusCode'>;

const SENSITIVE_QUERY_PARAM_SET = new Set<string>(SENSITIVE_QUERY_PARAMS);

export const isValidRequestId = (value: unknown): value is string => {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    REQUEST_ID_PATTERN.test(value)
  );
};

export const resolveRequestId = (req: RequestLike, res?: Partial<ResponseLike>): string => {
  let requestId: string;

  if (isValidRequestId(req.id)) {
    requestId = req.id;
  } else {
    const headerValue = req.headers?.[REQUEST_ID_HEADER_LOWER];
    const candidate = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    requestId = isValidRequestId(candidate) ? candidate : randomUUID();
    req.id = requestId;
  }

  if (res && typeof res.setHeader === 'function' && !res.headersSent) {
    res.setHeader(REQUEST_ID_HEADER, requestId);
  }

  return requestId;
};

export const sanitizeUrl = (url?: string): string => {
  if (!url) {
    return '';
  }

  const [urlWithoutHash, hash] = url.split('#', 2);
  const [pathname, rawQuery] = urlWithoutHash.split('?', 2);

  if (rawQuery === undefined) {
    return url;
  }

  const sanitizedQuery = rawQuery
    .split('&')
    .map(part => {
      if (!part) {
        return part;
      }

      const eqIndex = part.indexOf('=');
      const rawKey = eqIndex === -1 ? part : part.slice(0, eqIndex);

      let decodedKey = rawKey;
      try {
        decodedKey = decodeURIComponent(rawKey);
      } catch {
        // Keep raw key if malformed percent-encoding is sent
      }

      if (SENSITIVE_QUERY_PARAM_SET.has(decodedKey.toLowerCase())) {
        return `${rawKey}=${REDACTED_VALUE}`;
      }

      return part;
    })
    .join('&');

  const rebuilt = `${pathname}?${sanitizedQuery}`;
  return hash !== undefined ? `${rebuilt}#${hash}` : rebuilt;
};

const extractPathname = (req: RequestLike): string => {
  const rawUrl = req.originalUrl ?? req.url ?? '';
  const queryIndex = rawUrl.indexOf('?');
  return queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
};

export const customLogLevel = (req: RequestLike, res: ServerResponse, err?: Error): pino.LevelWithSilent => {
  const pathname = extractPathname(req);

  if (
    (pathname === HEALTH_ROUTE_PREFIX || pathname.startsWith(`${HEALTH_ROUTE_PREFIX}/`)) &&
    res.statusCode < 400 &&
    !err
  ) {
    return PinoLogLevels.SILENT;
  }

  if (res.statusCode >= 500 || err) {
    return PinoLogLevels.ERROR;
  }

  if (res.statusCode >= 400) {
    return PinoLogLevels.WARN;
  }

  return PinoLogLevels.INFO;
};

export const serializeRequest = (req: RequestLike): Record<string, unknown> => {
  return {
    id: req.id,
    method: req.method,
    url: sanitizeUrl(req.originalUrl ?? req.raw?.originalUrl ?? req.url),
    remoteAddress:
      req.remoteAddress ?? req.ip ?? req.raw?.ip ?? req.socket?.remoteAddress ?? req.raw?.socket?.remoteAddress,
  };
};

export const serializeResponse = (res: Pick<ServerResponse, 'statusCode'>): Record<string, unknown> => {
  return {
    statusCode: res.statusCode,
  };
};

export const observabilityMixin = (_mergeObject: object, _level: number, logger?: pino.Logger): object => {
  const context = getObservabilityContext();
  if (!context) {
    return {};
  }

  const bindings = typeof logger?.bindings === 'function' ? logger.bindings() : undefined;
  const fields: Record<string, string> = {};

  if (context.requestId && !bindings?.requestId) {
    fields.requestId = context.requestId;
  }

  if (context.jobId && !bindings?.jobId) {
    fields.jobId = context.jobId;
  }

  if (context.queueName && !bindings?.queueName) {
    fields.queueName = context.queueName;
  }

  if (context.jobName && !bindings?.jobName) {
    fields.jobName = context.jobName;
  }

  if (context.correlationId && !bindings?.correlationId) {
    fields.correlationId = context.correlationId;
  }

  return fields;
};

const shouldUsePrettyTransport = (nodeEnv: string): boolean => {
  return nodeEnv !== String(AppStatus.PRODUCTION) && nodeEnv !== String(AppStatus.TEST);
};

export const createPinoHttpOptions = (config: ObservabilityConfig): Options<IncomingMessage, ServerResponse> => {
  const baseOptions: Options<IncomingMessage, ServerResponse> = {
    level: config.logLevel,
    base: {
      service: OBSERVABILITY_SERVICE_NAME,
      processRole: config.processRole,
      env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: label => ({ level: label }),
    },
    redact: {
      paths: PINO_REDACT_PATHS,
      censor: REDACTED_VALUE,
    },
    mixin: observabilityMixin,
    ...(shouldUsePrettyTransport(config.nodeEnv)
      ? {
          transport: {
            target: require.resolve('pino-pretty'),
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:standard',
            },
          },
        }
      : {}),
  };

  if (config.processRole === ProcessRoles.WORKER) {
    return {
      ...baseOptions,
      autoLogging: false,
    };
  }

  return {
    ...baseOptions,
    customAttributeKeys: {
      reqId: 'requestId',
    },
    quietReqLogger: true,
    genReqId: (req, res) => resolveRequestId(req as RequestLike, res),
    serializers: {
      req: req => serializeRequest(req as RequestLike),
      res: res => serializeResponse(res as ServerResponse),
    },
    autoLogging: {
      ignore: () => false,
    },
    customLogLevel: (req, res, err) => customLogLevel(req as RequestLike, res, err),
  };
};
