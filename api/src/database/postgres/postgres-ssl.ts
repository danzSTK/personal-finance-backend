export type PostgresSslOptions = false | { rejectUnauthorized: false };

interface ResolvePostgresSslInput {
  isProduction: boolean;
  enabled?: boolean;
}

/**
 * Interpreta `POSTGRES_SSL`. Retorna `undefined` quando a variável não foi informada,
 * para que o padrão do ambiente continue valendo.
 *
 * Este módulo é carregado também pela CLI do TypeORM a partir de `dist`, portanto não
 * depende de NestJS nem de aliases `@/`.
 */
export const parsePostgresSslFlag = (value?: string): boolean | undefined => {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`POSTGRES_SSL must be "true" or "false", received "${value}"`);
};

/**
 * Valor explícito de `POSTGRES_SSL` prevalece; sem ele, TLS apenas em produção.
 * A cadeia do certificado não é validada (`rejectUnauthorized: false`).
 */
export const resolvePostgresSsl = ({ isProduction, enabled }: ResolvePostgresSslInput): PostgresSslOptions =>
  (enabled ?? isProduction) ? { rejectUnauthorized: false } : false;
