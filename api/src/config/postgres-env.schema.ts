import Joi from 'joi';

/**
 * Chaves de validação do PostgreSQL, compartilhadas por API e worker.
 * Extraídas do schema principal para poderem ser exercitadas isoladamente.
 */
export const postgresEnvSchema = {
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().required(),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),
  // Sem default: ausente preserva o padrão por ambiente (TLS apenas em produção).
  POSTGRES_SSL: Joi.boolean().optional(),
};
