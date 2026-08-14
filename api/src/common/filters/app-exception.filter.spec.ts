import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import {
  CurrentPasswordInvalidError,
  PasswordChangeBlockedError,
  PasswordChangeStateUnavailableError,
} from '@/modules/auth/application/errors';
import { ArgumentsHost } from '@nestjs/common';
import { MailError } from '@/shared/mail';

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
  });
});
