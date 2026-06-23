import { QueryFailedError } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION_CODE = '23505';

interface PostgresDriverError extends Error {
  code?: string;
  constraint?: string;
}

export function isPostgresUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError = error.driverError as PostgresDriverError;

  return driverError.code === POSTGRES_UNIQUE_VIOLATION_CODE;
}

export function getPostgresConstraintName(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) {
    return null;
  }

  const driverError = error.driverError as PostgresDriverError;

  return driverError.constraint ?? null;
}
