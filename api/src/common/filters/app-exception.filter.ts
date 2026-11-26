import { ApplicationError, RetryAfterApplicationError } from '@/shared/application';
import { DomainError } from '@/shared/domain';
import { OperationalAlertService } from '@/shared/observability/alerts/operational-alert.service';
import {
  ObservabilityLogEvents,
  OperationalAlertKeys,
  OperationalAlertSeverities,
} from '@/shared/observability/constants/observability.constants';
import { getObservabilityContext } from '@/shared/observability/context/observability-context';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, Optional } from '@nestjs/common';
import { Request, Response } from 'express';

const INTERNAL_SERVER_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
const RETRY_AFTER_HEADER = 'Retry-After';

type ErrorDetails = Record<string, unknown> | null;

interface PlatformErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
  details: ErrorDetails;
}

interface HttpExceptionResponseBody {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  error?: string;
  details?: ErrorDetails;
}

interface SafeSerializedError {
  type: string;
  code?: string | number;
  constraint?: string;
  message: string;
}

const ERROR_STATUS_BY_CODE: Record<string, HttpStatus> = {
  AVATAR_FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  AVATAR_UPLOAD_FAILED: HttpStatus.SERVICE_UNAVAILABLE,
  ACCOUNT_ALREADY_DEFAULT: HttpStatus.CONFLICT,
  ACCOUNT_ARCHIVED: HttpStatus.CONFLICT,
  ACCOUNT_ARCHIVED_MUTATION: HttpStatus.CONFLICT,
  ACCOUNT_CANNOT_BE_ARCHIVED: HttpStatus.CONFLICT,
  ACCOUNT_CANNOT_BE_DEFAULT: HttpStatus.CONFLICT,
  ACCOUNT_HAS_SCHEDULED_TRANSACTIONS: HttpStatus.CONFLICT,
  ACCOUNT_MUST_REMAIN_ACTIVE: HttpStatus.CONFLICT,
  ACCOUNT_NOT_ARCHIVED: HttpStatus.CONFLICT,
  ACCOUNT_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACCOUNT_TEMPLATE_NOT_FOUND: HttpStatus.NOT_FOUND,
  ACCOUNT_TEMPLATE_INPUT_CONFLICT: HttpStatus.BAD_REQUEST,
  ACCOUNT_UPDATE_EMPTY: HttpStatus.CONFLICT,
  CATEGORY_HAS_TRANSACTIONS: HttpStatus.CONFLICT,
  CATEGORY_INVALID_LIST_QUERY: HttpStatus.BAD_REQUEST,
  CATEGORY_INVALID_MERGE: HttpStatus.CONFLICT,
  CATEGORY_NAME_ALREADY_EXISTS: HttpStatus.CONFLICT,
  CATEGORY_NOT_FOUND: HttpStatus.NOT_FOUND,
  CATEGORY_NOT_MANAGEABLE: HttpStatus.CONFLICT,
  CATEGORY_UPDATE_EMPTY: HttpStatus.CONFLICT,
  INVALID_USERNAME_FORMAT: HttpStatus.BAD_REQUEST,
  INVALID_AVATAR_IMAGE: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_ACCOUNT: HttpStatus.BAD_REQUEST,
  INVALID_ACCOUNT_TEMPLATE: HttpStatus.BAD_REQUEST,
  INVALID_ACCOUNT_NAME: HttpStatus.BAD_REQUEST,
  INVALID_CATEGORY: HttpStatus.BAD_REQUEST,
  TECHNICAL_CATEGORY_CANNOT_BE_CREATED: HttpStatus.BAD_REQUEST,
  INVALID_ATTACHMENT_POSITION: HttpStatus.BAD_REQUEST,
  ATTACHMENT_FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  UNSUPPORTED_ATTACHMENT_FILE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  ATTACHMENT_DIMENSIONS_EXCEEDED: HttpStatus.UNPROCESSABLE_ENTITY,
  INVALID_TRANSACTION: HttpStatus.BAD_REQUEST,
  BALANCE_ADJUSTMENT_NO_DIFFERENCE: HttpStatus.CONFLICT,
  TRANSACTION_ACCOUNT_UNAVAILABLE: HttpStatus.CONFLICT,
  TRANSACTION_ALREADY_EFFECTIVE: HttpStatus.CONFLICT,
  TRANSACTION_CANNOT_DELETE_TRANSFER: HttpStatus.CONFLICT,
  TRANSACTION_CATEGORY_INCOMPATIBLE: HttpStatus.BAD_REQUEST,
  TRANSACTION_CATEGORY_UNAVAILABLE: HttpStatus.BAD_REQUEST,
  TRANSACTION_INVALID_STATE_TRANSITION: HttpStatus.CONFLICT,
  TRANSACTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  TRANSACTION_UPDATE_EMPTY: HttpStatus.CONFLICT,
  TRANSACTION_TYPE_DOES_NOT_SUPPORT_ATTACHMENTS: HttpStatus.CONFLICT,
  TRANSACTION_ATTACHMENT_FILES_EMPTY: HttpStatus.BAD_REQUEST,
  TRANSACTION_ATTACHMENT_LIMIT_EXCEEDED: HttpStatus.CONFLICT,
  TRANSACTION_ATTACHMENT_NOT_FOUND: HttpStatus.NOT_FOUND,
  USER_EMAIL_ALREADY_EXISTS: HttpStatus.CONFLICT,
  USERNAME_ALREADY_EXISTS: HttpStatus.CONFLICT,
  USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  USER_UPDATE_INPUT_VOID: HttpStatus.BAD_REQUEST,
  INVALID_USER: HttpStatus.BAD_REQUEST,
  MAIL_INVALID_PAYLOAD: HttpStatus.BAD_REQUEST,
  MAIL_PROVIDER_REJECTED: HttpStatus.BAD_GATEWAY,
  MAIL_PROVIDER_TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  MAIL_PROVIDER_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  MAIL_PROVIDER_UNKNOWN: HttpStatus.BAD_GATEWAY,
  MAIL_TEMPLATE_MAPPING_MISSING: HttpStatus.INTERNAL_SERVER_ERROR,
  EMAIL_TEMPLATE_UNKNOWN: HttpStatus.INTERNAL_SERVER_ERROR,
  EMAIL_TEMPLATE_VERSION_UNSUPPORTED: HttpStatus.INTERNAL_SERVER_ERROR,
  EMAIL_TEMPLATE_PARAMS_INVALID: HttpStatus.INTERNAL_SERVER_ERROR,
  EMAIL_MESSAGE_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_EMAIL_MESSAGE: HttpStatus.BAD_REQUEST,
  AUTH_PROVIDER_ALREADY_LINKED: HttpStatus.CONFLICT,
  AUTH_PROVIDER_LINKED_TO_ANOTHER_USER: HttpStatus.CONFLICT,
  EMAIL_VERIFICATION_COOLDOWN_ACTIVE: HttpStatus.TOO_MANY_REQUESTS,
  EMAIL_VERIFICATION_DAILY_LIMIT_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
  EMAIL_VERIFICATION_OPERATION_PENDING: HttpStatus.TOO_MANY_REQUESTS,
  EMAIL_VERIFICATION_STATE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  EMAIL_VERIFICATION_REQUIRED: HttpStatus.FORBIDDEN,
  EMAIL_VERIFICATION_TOKEN_EXPIRED: HttpStatus.GONE,
  EMAIL_VERIFICATION_TOKEN_INVALID: HttpStatus.BAD_REQUEST,
  EMAIL_VERIFICATION_USER_BLOCKED: HttpStatus.CONFLICT,
  EMAIL_VERIFICATION_USER_NOT_FOUND: HttpStatus.NOT_FOUND,
  INVALID_EMAIL_VERIFICATION_CHALLENGE: HttpStatus.BAD_REQUEST,
  INVALID_ACCESS_TOKEN: HttpStatus.UNAUTHORIZED,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  POTENTIAL_SESSION_HIJACKING: HttpStatus.UNAUTHORIZED,
  SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  UNSUPPORTED_AVATAR_FILE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  CURRENT_PASSWORD_INVALID: HttpStatus.FORBIDDEN,
  PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED: HttpStatus.CONFLICT,
  NEW_PASSWORD_MUST_DIFFER: HttpStatus.BAD_REQUEST,
  PASSWORD_CHANGE_BLOCKED: HttpStatus.TOO_MANY_REQUESTS,
  PASSWORD_CHANGE_COOLDOWN_ACTIVE: HttpStatus.TOO_MANY_REQUESTS,
  PASSWORD_CHANGE_DAILY_LIMIT_EXCEEDED: HttpStatus.TOO_MANY_REQUESTS,
  PASSWORD_CHANGE_OPERATION_PENDING: HttpStatus.TOO_MANY_REQUESTS,
  PASSWORD_CHANGE_COST_LIMITED: HttpStatus.TOO_MANY_REQUESTS,
  PASSWORD_CHANGE_STATE_UNAVAILABLE: HttpStatus.SERVICE_UNAVAILABLE,
  INVALID_PASSWORD_CHANGE_EVENT: HttpStatus.BAD_REQUEST,
  PASSWORD_BYTE_LIMIT_EXCEEDED: HttpStatus.BAD_REQUEST,
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  constructor(
    @Optional()
    private readonly operationalAlertService?: OperationalAlertService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const errorResponse = this.toErrorResponse(exception, request);

    if (
      errorResponse.statusCode === Number(HttpStatus.INTERNAL_SERVER_ERROR) &&
      errorResponse.code === INTERNAL_SERVER_ERROR_CODE
    ) {
      const normalizedRoute = this.normalizeRoute(request);
      const requestId = this.resolveRequestId(request);

      this.logger.error({
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        method: request.method,
        route: normalizedRoute,
        statusCode: errorResponse.statusCode,
        errorCode: errorResponse.code,
        ...(requestId ? { requestId } : {}),
        error: this.serializeSafeError(exception),
      });

      this.operationalAlertService?.notify({
        alertKey: OperationalAlertKeys.http500(request.method, normalizedRoute),
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        title: 'Erro interno inesperado na API (500)',
        summary: `${request.method} ${normalizedRoute} falhou com erro inesperado.`,
        requestId,
        metadata: {
          method: request.method,
          route: normalizedRoute,
          statusCode: errorResponse.statusCode,
        },
      });
    }

    if (exception instanceof RetryAfterApplicationError) {
      response.setHeader(RETRY_AFTER_HEADER, String(exception.retryAfterSeconds));
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private toErrorResponse(exception: unknown, request: Request): PlatformErrorResponse {
    if (exception instanceof DomainError || exception instanceof ApplicationError) {
      return this.createResponse({
        statusCode: ERROR_STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        details: exception instanceof RetryAfterApplicationError ? exception.details : null,
        request,
      });
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    return this.createResponse({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: INTERNAL_SERVER_ERROR_CODE,
      message: 'Internal server error.',
      request,
    });
  }

  private fromHttpException(exception: HttpException, request: Request): PlatformErrorResponse {
    const statusCode = exception.getStatus();
    const body = this.normalizeHttpExceptionBody(exception.getResponse());
    const validationMessages = Array.isArray(body.message) ? body.message : null;

    return this.createResponse({
      statusCode,
      code: body.code ?? this.toErrorCode(body.error ?? HttpStatus[statusCode] ?? 'HTTP_ERROR'),
      message: this.getHttpExceptionMessage(body, exception),
      details: body.details ?? (validationMessages ? { messages: validationMessages } : null),
      request,
    });
  }

  private normalizeHttpExceptionBody(responseBody: string | object): HttpExceptionResponseBody {
    if (typeof responseBody === 'string') {
      return { message: responseBody };
    }

    return responseBody as HttpExceptionResponseBody;
  }

  private getHttpExceptionMessage(body: HttpExceptionResponseBody, exception: HttpException): string {
    if (typeof body.message === 'string') {
      return body.message;
    }

    if (Array.isArray(body.message)) {
      return 'Request validation failed.';
    }

    if (body.error) {
      return body.error;
    }

    return exception.message;
  }

  private createResponse(input: {
    statusCode: number;
    code: string;
    message: string;
    request: Request;
    details?: ErrorDetails;
  }): PlatformErrorResponse {
    return {
      statusCode: input.statusCode,
      code: input.code,
      message: input.message,
      path: input.request.originalUrl ?? input.request.url,
      timestamp: new Date().toISOString(),
      details: input.details ?? null,
    };
  }

  private toErrorCode(value: string): string {
    return value
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();
  }

  private normalizeRoute(request: Request): string {
    const routeRequest = request as unknown as { route?: { path?: unknown }; baseUrl?: string };
    const routePath = routeRequest.route?.path;

    if (typeof routePath === 'string' && routePath.length > 0) {
      return `${routeRequest.baseUrl ?? ''}${routePath}`.slice(0, 120);
    }

    const rawUrl = request.originalUrl ?? request.url ?? '/';
    const pathname = rawUrl.split('?', 1)[0] || '/';

    return pathname
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/:uuid')
      .replace(/\/\d+(?=\/|$)/g, '/:id')
      .slice(0, 120);
  }

  private resolveRequestId(request: Request): string | undefined {
    const requestId = (request as Request & { id?: unknown }).id;
    if (typeof requestId === 'string' && requestId.length > 0) {
      return requestId;
    }

    return getObservabilityContext()?.requestId;
  }

  private serializeSafeError(exception: unknown): SafeSerializedError {
    if (typeof exception === 'object' && exception !== null) {
      const record = exception as {
        query?: unknown;
        parameters?: unknown;
        driverError?: unknown;
        code?: unknown;
      };

      if ('query' in record || 'parameters' in record || 'driverError' in record) {
        const driverError =
          typeof record.driverError === 'object' && record.driverError !== null
            ? (record.driverError as { code?: unknown; constraint?: unknown })
            : undefined;
        const rawCode = driverError?.code ?? record.code;
        const code = this.readShortErrorCode(rawCode);
        const constraint =
          typeof driverError?.constraint === 'string' && driverError.constraint.length > 0
            ? driverError.constraint
            : undefined;

        return {
          type: exception instanceof Error && exception.name ? exception.name : 'DatabaseError',
          ...(code !== undefined ? { code } : {}),
          ...(constraint !== undefined ? { constraint } : {}),
          message: 'Database query failed',
        };
      }

      if (exception instanceof Error) {
        const code = this.readShortErrorCode(record.code);

        return {
          type: exception.name || 'Error',
          ...(code !== undefined ? { code } : {}),
          message: exception.message,
        };
      }
    }

    return {
      type: 'UnknownError',
      message: 'Non-Error exception thrown',
    };
  }

  private readShortErrorCode(rawCode: unknown): string | number | undefined {
    if (typeof rawCode === 'string' && rawCode.length > 0 && rawCode.length <= 64) {
      return rawCode;
    }

    if (typeof rawCode === 'number' && Number.isFinite(rawCode)) {
      return rawCode;
    }

    return undefined;
  }
}
