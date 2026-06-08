import { BadRequestException, HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface ValidationFieldError {
  field: string;
  messages: string[];
}

export function createValidationException(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    code: 'VALIDATION_ERROR',
    message: 'Request validation failed.',
    details: {
      fields: flattenValidationErrors(errors),
    },
  });
}

function flattenValidationErrors(errors: ValidationError[], parentPath?: string): ValidationFieldError[] {
  return errors.flatMap(error => {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    const messages = error.constraints ? Object.values(error.constraints) : [];
    const children = error.children?.length ? flattenValidationErrors(error.children, fieldPath) : [];

    if (messages.length === 0) {
      return children;
    }

    return [
      {
        field: fieldPath,
        messages,
      },
      ...children,
    ];
  });
}
