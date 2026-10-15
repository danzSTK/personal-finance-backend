import Joi from 'joi';
import { postgresEnvSchema } from './postgres-env.schema';

interface ValidatedPostgresEnv {
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  POSTGRES_SSL?: boolean;
}

interface ValidationOutput {
  error?: Joi.ValidationError;
  value: ValidatedPostgresEnv;
}

describe('postgresEnvSchema', () => {
  const schema = Joi.object(postgresEnvSchema);
  const baseEnv = {
    POSTGRES_HOST: 'postgres',
    POSTGRES_PORT: '5432',
    POSTGRES_USER: 'danfy',
    POSTGRES_PASSWORD: 'secret',
    POSTGRES_DB: 'danfy',
  };

  const validate = (env: Record<string, unknown>, options?: Joi.ValidationOptions): ValidationOutput =>
    schema.validate(env, options) as unknown as ValidationOutput;

  describe('POSTGRES_SSL', () => {
    it('accepts the environment without POSTGRES_SSL and does not inject a default', () => {
      const result = validate(baseEnv);

      expect(result.error).toBeUndefined();
      expect(result.value).not.toHaveProperty('POSTGRES_SSL');
    });

    it.each([
      ['true', true],
      ['false', false],
    ])('converts %p to the boolean %p', (input, expected) => {
      const result = validate({ ...baseEnv, POSTGRES_SSL: input });

      expect(result.error).toBeUndefined();
      expect(result.value.POSTGRES_SSL).toBe(expected);
    });

    it.each(['talvez', 'require', ''])('rejects %p so the process does not start', input => {
      const result = validate({ ...baseEnv, POSTGRES_SSL: input });

      expect(result.error).toBeDefined();
    });
  });

  describe('connection settings', () => {
    it('keeps the connection variables required', () => {
      const result = validate({ POSTGRES_SSL: 'false' }, { abortEarly: false });

      expect(result.error?.details.map(detail => detail.path[0])).toEqual(
        expect.arrayContaining(['POSTGRES_HOST', 'POSTGRES_PORT', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB']),
      );
    });
  });
});
