import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

interface PostgresDriverError extends Error {
  code?: string;
  constraint?: string;
}

export function isPostgresUniqueViolation(error: unknown, constraintName?: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as PostgresDriverError;

  if (driverError.code !== POSTGRES_UNIQUE_VIOLATION_CODE) {
    return false;
  }

  return constraintName ? driverError.constraint === constraintName : true;
}
