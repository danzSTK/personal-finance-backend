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
import { MailError } from '@/shared/mail/errors';
import { OperationalAlertService } from '@/shared/observability/alerts/operational-alert.service';
import {
  ObservabilityLogEvents,
  OperationalAlertKeys,
  OperationalAlertSeverities,
} from '@/shared/observability/constants/observability.constants';
import { PasswordByteLimitExceededError } from '@/common/domain/errors';
import {
  FiscalNoteAlreadyImportedError,
  FiscalNoteCancelledOrDeniedError,
  FiscalNoteHomologationNotAllowedError,
  FiscalNoteInvalidInputError,
  FiscalNoteNotFoundError,
  FiscalNoteParseFailedError,
  FiscalNoteRateLimitExceededError,
  FiscalNoteResponseTooLargeError,
  FiscalNoteSefazNotFoundError,
  FiscalNoteUnsupportedUfError,
  SefazTemporarilyUnavailableError,
  SefazTimeoutError,
  TransactionAlreadyHasFiscalNoteError,
} from '@/modules/fiscal-notes/application/errors';
import { FiscalNoteErrorCodes } from '@/modules/fiscal-notes/domain/constants/fiscal-notes.constants';
import { InvalidFiscalNoteError } from '@/modules/fiscal-notes/domain/errors';
import { DomainError } from '@/shared/domain';

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
          error: {
            type: 'UnknownError',
            message: 'Non-Error exception thrown',
          },
        }),
      );
      expect(errorSpy.mock.calls[0][0]).not.toHaveProperty('err');

      errorSpy.mockRestore();
    });

    it('serializes QueryFailedError without leaking query, parameters, or driverError PII', () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const notify = jest.fn();
      const filter = new AppExceptionFilter({ notify } as unknown as OperationalAlertService);

      const queryError = Object.assign(new Error('duplicate key value violates unique constraint "UQ_users_email"'), {
        name: 'QueryFailedError',
        query: 'INSERT INTO "users" ("email", "cpf") VALUES ($1, $2)',
        parameters: ['user@example.com', '12345678901'],
        driverError: {
          code: '23505',
          constraint: 'UQ_users_email',
          detail: 'Key (email)=(user@example.com) already exists.',
        },
      });

      const routedRequest = {
        method: 'POST',
        id: 'req-db-500',
        originalUrl: '/auth/signup',
        url: '/auth/signup',
      };
      const localHost = {
        switchToHttp: () => ({
          getRequest: () => routedRequest,
          getResponse: () => response,
          getNext: jest.fn(),
        }),
      } as unknown as ArgumentsHost;

      filter.catch(queryError, localHost);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalledTimes(1);

      const loggedPayload = errorSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(loggedPayload).toMatchObject({
        event: ObservabilityLogEvents.UNHANDLED_HTTP_EXCEPTION,
        method: 'POST',
        route: '/auth/signup',
        statusCode: 500,
        errorCode: 'INTERNAL_SERVER_ERROR',
        requestId: 'req-db-500',
        error: {
          type: 'QueryFailedError',
          code: '23505',
          constraint: 'UQ_users_email',
          message: 'Database query failed',
        },
      });
      expect(loggedPayload).not.toHaveProperty('err');
      expect(loggedPayload.error).not.toHaveProperty('query');
      expect(loggedPayload.error).not.toHaveProperty('parameters');
      expect(loggedPayload.error).not.toHaveProperty('driverError');

      const serialized = JSON.stringify(loggedPayload);
      expect(serialized).not.toContain('user@example.com');
      expect(serialized).not.toContain('12345678901');
      expect(serialized).not.toContain('INSERT INTO');

      errorSpy.mockRestore();
    });

    it('does not trigger operational alerts for 4xx HttpExceptions', () => {
      const notify = jest.fn();
      const filter = new AppExceptionFilter({ notify } as unknown as OperationalAlertService);

      filter.catch(new BadRequestException('Invalid payload'), host);

      expect(response.status).toHaveBeenCalledWith(400);
      expect(notify).not.toHaveBeenCalled();
    });

    it('propagates ApplicationError details for FiscalNoteAlreadyImportedError and TransactionAlreadyHasFiscalNoteError (409)', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new FiscalNoteAlreadyImportedError('tx-existing', 'fn-existing'), host);

      expect(response.setHeader).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          code: FiscalNoteErrorCodes.FISCAL_NOTE_ALREADY_IMPORTED,
          details: {
            existingTransactionId: 'tx-existing',
            existingFiscalNoteId: 'fn-existing',
          },
        }),
      );

      filter.catch(new TransactionAlreadyHasFiscalNoteError('fn-attached'), host);

      expect(response.status).toHaveBeenCalledWith(409);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          code: FiscalNoteErrorCodes.TRANSACTION_ALREADY_HAS_FISCAL_NOTE,
          details: {
            existingFiscalNoteId: 'fn-attached',
          },
        }),
      );
    });

    it('sets Retry-After header for FiscalNoteRateLimitExceededError (429) and SefazTemporarilyUnavailableError (503)', () => {
      const filter = new AppExceptionFilter();

      filter.catch(new FiscalNoteRateLimitExceededError(42), host);

      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '42');
      expect(response.status).toHaveBeenCalledWith(429);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 429,
          code: FiscalNoteErrorCodes.FISCAL_NOTE_RATE_LIMIT_EXCEEDED,
          details: {
            retryAfterSeconds: 42,
          },
        }),
      );

      filter.catch(new SefazTemporarilyUnavailableError(120), host);

      expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '120');
      expect(response.status).toHaveBeenCalledWith(503);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 503,
          code: FiscalNoteErrorCodes.SEFAZ_TEMPORARILY_UNAVAILABLE,
          details: {
            retryAfterSeconds: 120,
          },
        }),
      );
    });

    it('maps remaining fiscal note and transaction fiscal note error codes to expected HTTP statuses', () => {
      const filter = new AppExceptionFilter();
      class TransactionTypeDoesNotSupportFiscalNoteStubError extends DomainError {
        readonly code = 'TRANSACTION_TYPE_DOES_NOT_SUPPORT_FISCAL_NOTE';
        constructor() {
          super('Only EXPENSE transactions support fiscal notes.');
        }
      }
      const transactionTypeError = new TransactionTypeDoesNotSupportFiscalNoteStubError();

      const cases: Array<[unknown, number]> = [
        [new FiscalNoteInvalidInputError(), 400],
        [new InvalidFiscalNoteError('Invalid'), 400],
        [new FiscalNoteNotFoundError(), 404],
        [new FiscalNoteSefazNotFoundError(), 404],
        [transactionTypeError, 409],
        [new FiscalNoteUnsupportedUfError('35'), 422],
        [new FiscalNoteHomologationNotAllowedError(), 422],
        [new FiscalNoteCancelledOrDeniedError(), 422],
        [new FiscalNoteParseFailedError(), 502],
        [new FiscalNoteResponseTooLargeError(), 502],
        [new SefazTimeoutError(), 504],
      ];

      for (const [error, expectedStatus] of cases) {
        response.status.mockClear();
        filter.catch(error, host);
        expect(response.status).toHaveBeenCalledWith(expectedStatus);
      }
    });
  });
});
