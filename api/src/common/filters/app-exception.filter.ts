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
  INVALID_USERNAME_FORMAT: HttpStatus.BAD_REQUEST,
  USERNAME_ALREADY_EXISTS: HttpStatus.CONFLICT,
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
