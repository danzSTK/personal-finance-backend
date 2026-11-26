import {
  TransactionTypeDoesNotSupportAttachmentsError,
  TransactionAttachmentLimitExceededError,
  InvalidAttachmentPositionError,
} from '@/modules/transactions/domain/errors';
import {
  BalanceAdjustmentNoDifferenceError,
  TransactionAttachmentNotFoundError,
  UnsupportedAttachmentFileError,
  AttachmentFileTooLargeError,
  AttachmentDimensionsExceededError,
} from '@/modules/transactions/application/errors';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import {
  CurrentPasswordInvalidError,
  PasswordChangeBlockedError,
  PasswordChangeStateUnavailableError,
} from '@/modules/auth/application/errors';
import { ArgumentsHost, BadRequestException, Logger } from '@nestjs/common';
import { MailError } from '@/shared/mail';
import { OperationalAlertService } from '@/shared/observability/alerts/operational-alert.service';
import {
  ObservabilityLogEvents,
  OperationalAlertKeys,
  OperationalAlertSeverities,
} from '@/shared/observability/constants/observability.constants';
import { PasswordByteLimitExceededError } from '@/common/domain/errors';

describe('AppExceptionFilter', () => {
  const request = {
    method: 'POST',
    originalUrl: '/auth/password/change',
    url: '/auth/password/change',
  };
  let response: {
    status: jest.Mock;
    setHeader: jest.Mock;
    json: jest.Mock;
  };
  let host: ArgumentsHost;

  beforeEach(() => {
    response = {
      status: jest.fn(),
      setHeader: jest.fn(),
      json: jest.fn(),
    };
    response.status.mockReturnValue(response);
    host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
        getNext: jest.fn(),
      }),
    } as unknown as ArgumentsHost;
  });

  describe('catch', () => {
    it('serializes retry details and writes the Retry-After header', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new PasswordChangeBlockedError(61), host);

      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '61');
      expect(response.status).toHaveBeenCalledWith(429);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          code: 'PASSWORD_CHANGE_BLOCKED',
          details: {
            retryAfterSeconds: 61,
          },
        }),
      );
    });

    it('maps the wrong current password to forbidden without Retry-After', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new CurrentPasswordInvalidError(), host);

      expect(response.setHeader).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(403);
    });

    it('maps unavailable operational state to service unavailable', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new PasswordChangeStateUnavailableError(), host);

      expect(response.status).toHaveBeenCalledWith(503);
    });

    it('maps the internal password byte limit error without exposing input data', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new PasswordByteLimitExceededError(), host);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'PASSWORD_BYTE_LIMIT_EXCEEDED',
          details: null,
        }),
      );
    });

    it('maps missing provider template configuration to an internal error', () => {
      const filter = new AppExceptionFilter();

      filter.catch(MailError.templateMappingMissing('welcome-email', 1), host);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'MAIL_TEMPLATE_MAPPING_MISSING',
        }),
      );
    });

    it('maps transaction attachment domain and application errors to their respective HTTP statuses', () => {
      const filter = new AppExceptionFilter();
      filter.catch(new TransactionTypeDoesNotSupportAttachmentsError(), host);
      expect(response.status).toHaveBeenCalledWith(409);

      filter.catch(new TransactionAttachmentLimitExceededError(), host);
      expect(response.status).toHaveBeenCalledWith(409);

      filter.catch(new TransactionAttachmentNotFoundError(), host);
      expect(response.status).toHaveBeenCalledWith(404);

      filter.catch(new InvalidAttachmentPositionError(), host);
      expect(response.status).toHaveBeenCalledWith(400);

      filter.catch(new UnsupportedAttachmentFileError(), host);
      expect(response.status).toHaveBeenCalledWith(415);

      filter.catch(new AttachmentFileTooLargeError(), host);
      expect(response.status).toHaveBeenCalledWith(413);

      filter.catch(new AttachmentDimensionsExceededError(), host);
      expect(response.status).toHaveBeenCalledWith(422);
    });

    it('maps balance adjustment no difference error to conflict', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new BalanceAdjustmentNoDifferenceError(), host);

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          code: 'BALANCE_ADJUSTMENT_NO_DIFFERENCE',
          details: null,
        }),
      );
    });

    it('logs UNHANDLED_HTTP_EXCEPTION without req.body and triggers CRITICAL alert for 500 errors', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const notify = jest.fn();
      const filter = new AppExceptionFilter({ notify } as unknown as OperationalAlertService);

      const detailedRequest = {
        method: 'POST',
        id: 'req-500-1',
        originalUrl: '/transactions/550e8400-e293-41d4-a716-446655440000?token=secret',
        url: '/transactions/550e8400-e293-41d4-a716-446655440000?token=secret',
        body: { password: 'should-never-be-logged' },
      };
      const localHost = {
        switchToHttp: () => ({
          getRequest: () => detailedRequest,
          getResponse: () => response,
          getNext: jest.fn(),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(new Error('Database exploded'), localHost);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
          method: 'POST',
          route: '/transactions/:uuid',
          statusCode: 500,
          errorCode: 'INTERNAL_SERVER_ERROR',
          requestId: 'req-500-1',
        }),
      );
      expect(errorSpy.mock.calls[0][0]).not.toHaveProperty('body');
      expect(notify).toHaveBeenCalledWith({
        alertKey: OperationalAlertKeys.http500('POST', '/transactions/:uuid'),
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        severity: OperationalAlertSeverities.CRITICAL,
        title: 'Erro interno inesperado na API (500)',
        summary: 'POST /transactions/:uuid falhou com erro inesperado.',
        requestId: 'req-500-1',
        metadata: {
          method: 'POST',
          route: '/transactions/:uuid',
          statusCode: 500,
        },
      });

      errorSpy.mockRestore();
    });

    it('uses express route path when available and handles non-Error throws safely', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const notify = jest.fn();
      const filter = new AppExceptionFilter({ notify } as unknown as OperationalAlertService);

      const routedRequest = {
        method: 'GET',
        baseUrl: '/accounts',
        route: { path: '/:id' },
        originalUrl: '/accounts/123',
        url: '/accounts/123',
      };
      const localHost = {
        switchToHttp: () => ({
          getRequest: () => routedRequest,
          getResponse: () => response,
          getNext: jest.fn(),
        }),
      } as unknown as ArgumentsHost;

      filter.catch('unexpected string error', localHost);

      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          alertKey: OperationalAlertKeys.http500('GET', '/accounts/:id'),
        }),
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          err: { message: 'unexpected string error' },
        }),
      );

      errorSpy.mockRestore();
    });

    it('does not trigger operational alerts for 4xx HttpExceptions', () => {
      const notify = jest.fn();
      const filter = new AppExceptionFilter({ notify } as unknown as OperationalAlertService);

      filter.catch(new BadRequestException('Invalid payload'), host);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(notify).not.toHaveBeenCalled();
    });
  });
});
