import { ApplicationError } from '@/shared/application';
import { DomainError } from '@/shared/domain';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

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
  INVALID_ACCOUNT_NAME: HttpStatus.BAD_REQUEST,
  INVALID_CATEGORY: HttpStatus.BAD_REQUEST,
  TECHNICAL_CATEGORY_CANNOT_BE_CREATED: HttpStatus.BAD_REQUEST,
  INVALID_TRANSACTION: HttpStatus.BAD_REQUEST,
  TRANSACTION_ACCOUNT_UNAVAILABLE: HttpStatus.CONFLICT,
  TRANSACTION_ALREADY_EFFECTIVE: HttpStatus.CONFLICT,
  TRANSACTION_CANNOT_DELETE_TRANSFER: HttpStatus.CONFLICT,
  TRANSACTION_CATEGORY_INCOMPATIBLE: HttpStatus.BAD_REQUEST,
  TRANSACTION_CATEGORY_UNAVAILABLE: HttpStatus.BAD_REQUEST,
  TRANSACTION_INVALID_STATE_TRANSITION: HttpStatus.CONFLICT,
  TRANSACTION_NOT_FOUND: HttpStatus.NOT_FOUND,
  TRANSACTION_UPDATE_EMPTY: HttpStatus.CONFLICT,
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
  AUTH_PROVIDER_ALREADY_LINKED: HttpStatus.CONFLICT,
  AUTH_PROVIDER_LINKED_TO_ANOTHER_USER: HttpStatus.CONFLICT,
  INVALID_ACCESS_TOKEN: HttpStatus.UNAUTHORIZED,
  INVALID_REFRESH_TOKEN: HttpStatus.UNAUTHORIZED,
  POTENTIAL_SESSION_HIJACKING: HttpStatus.UNAUTHORIZED,
  SESSION_NOT_FOUND: HttpStatus.NOT_FOUND,
  UNSUPPORTED_AVATAR_FILE: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
};

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    const errorResponse = this.toErrorResponse(exception, request);

    if (errorResponse.code === 'INTERNAL_SERVER_ERROR') {
      this.logger.error(this.toLogMessage(exception, request));
    }

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private toErrorResponse(exception: unknown, request: Request): PlatformErrorResponse {
    if (exception instanceof DomainError || exception instanceof ApplicationError) {
      return this.createResponse({
        statusCode: ERROR_STATUS_BY_CODE[exception.code] ?? HttpStatus.BAD_REQUEST,
        code: exception.code,
        message: exception.message,
        request,
      });
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception, request);
    }

    return this.createResponse({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
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

  private toLogMessage(exception: unknown, request: Request): string {
    const error = exception instanceof Error ? exception.stack : String(exception);

    return `${request.method} ${request.originalUrl ?? request.url} failed: ${error}`;
  }
}
