---
area: platform
type: reference
status: current
last_reviewed: 2026-07-23
related:
  - ./getting-started.md
  - ./deploy.md
  - ./platform/worker-operations.md
  - ./platform/queue-infrastructure.md
---

# Configuração por variáveis de ambiente

Esta é a referência das variáveis de ambiente do Danfy Backend. O arquivo [`.env.exemple`](../.env.exemple) contém valores locais seguros e a união das configurações da API e do worker.

O schema Joi em [`api/src/config/config.module.ts`](../api/src/config/config.module.ts) é a fonte de verdade para validação, defaults e requisitos condicionais. Duas variáveis operacionais ficam fora dele:

- `APP_VERSION`, interpretada pelo Docker Compose antes do bootstrap do NestJS;
- `WORKER_INSTANCE_ID`, lida diretamente pelo worker e substituída pelo hostname quando ausente.

## Como interpretar as tabelas

| Regra       | Significado                                                                       |
| ----------- | --------------------------------------------------------------------------------- |
| Obrigatória | precisa de um valor válido; o processo não inicia sem ela                         |
| Condicional | passa a ser obrigatória somente quando a condição informada é verdadeira          |
| Default     | pode ser omitida; o schema Joi aplica o valor documentado                         |
| Opcional    | pode ser omitida e não recebe default do Joi                                      |
| Operacional | é consumida pelo Compose ou diretamente pelo runtime, fora da validação principal |

No desenvolvimento local, um único `.env` contém todas as seções. Em ambientes com secrets separados:

- API: variáveis compartilhadas mais as variáveis somente API;
- worker: variáveis compartilhadas mais as variáveis somente worker;
- `PROCESS_ROLE` deve ser `api` ou `worker` conforme o processo;
- `APP_VERSION` pertence à orquestração da imagem, não ao código da aplicação.

## Orquestração

| Variável       | Regra       | Default | Uso                                                         |
| -------------- | ----------- | ------- | ----------------------------------------------------------- |
| `APP_VERSION`  | Operacional | —       | tag/versão da imagem exigida pelo Docker Compose            |
| `PROCESS_ROLE` | Default     | `api`   | seleciona o bootstrap e a validação condicional do processo |

O serviço Compose do worker e os scripts `start:worker:*` definem `PROCESS_ROLE=worker`. Não reutilize `api` para iniciar um consumidor.

## Compartilhadas entre API e worker

### PostgreSQL

| Variável            | Regra       | Default | Uso                                  |
| ------------------- | ----------- | ------- | ------------------------------------ |
| `POSTGRES_HOST`     | Obrigatória | —       | host do PostgreSQL                   |
| `POSTGRES_PORT`     | Obrigatória | —       | porta do PostgreSQL                  |
| `POSTGRES_USER`     | Obrigatória | —       | usuário da conexão                   |
| `POSTGRES_PASSWORD` | Obrigatória | —       | senha da conexão                     |
| `POSTGRES_DB`       | Obrigatória | —       | banco de dados da aplicação e outbox |

### Redis de cache e sessões

| Variável         | Regra       | Default | Uso                                     |
| ---------------- | ----------- | ------- | --------------------------------------- |
| `REDIS_HOST`     | Obrigatória | —       | host do Redis de cache, sessões e locks |
| `REDIS_PORT`     | Obrigatória | —       | porta do Redis principal                |
| `REDIS_PASSWORD` | Obrigatória | —       | senha do Redis principal                |
| `REDIS_TTL`      | Default     | `3600`  | TTL padrão do cache, em segundos        |

### BullMQ Redis e política dos jobs

API e worker compartilham a conexão e a política de jobs: a API e os handlers publicam trabalho, enquanto o worker consome e reconcilia as filas.

| Variável                    | Regra       | Default            | Uso                                     |
| --------------------------- | ----------- | ------------------ | --------------------------------------- |
| `BULLMQ_REDIS_HOST`         | Obrigatória | —                  | host do Redis dedicado às filas         |
| `BULLMQ_REDIS_PORT`         | Default     | `6379`             | porta do Redis das filas                |
| `BULLMQ_REDIS_PASSWORD`     | Opcional    | —                  | senha do Redis das filas                |
| `BULLMQ_REDIS_DB`           | Default     | `1`                | database lógico do Redis das filas      |
| `BULLMQ_PREFIX`             | Default     | `personal-finance` | namespace das chaves BullMQ             |
| `BULLMQ_DEFAULT_ATTEMPTS`   | Default     | `5`                | tentativas de jobs sem política própria |
| `BULLMQ_BACKOFF_TYPE`       | Default     | `exponential`      | backoff `fixed` ou `exponential`        |
| `BULLMQ_BACKOFF_DELAY_MS`   | Default     | `5000`             | intervalo base do backoff               |
| `BULLMQ_REMOVE_ON_COMPLETE` | Default     | `1000`             | quantidade de jobs concluídos retidos   |
| `BULLMQ_REMOVE_ON_FAIL`     | Default     | `5000`             | quantidade de jobs falhos retidos       |

O exemplo local define `BULLMQ_REDIS_PORT=6381` porque essa é a porta publicada no host pelo `docker-compose.dev.yml`, e define explicitamente `BULLMQ_REDIS_DB=0`. Dentro da rede Compose, o serviço continua acessível em `bullmq-redis:6379`.

### Cloudflare R2

O storage é compartilhado: a API recebe e persiste assets, e o worker executa tarefas assíncronas de lifecycle, como a remoção de objetos substituídos.

| Variável                 | Regra       | Default | Uso                                              |
| ------------------------ | ----------- | ------- | ------------------------------------------------ |
| `R2_ENDPOINT`            | Obrigatória | —       | endpoint S3 compatível da conta Cloudflare       |
| `R2_ACCOUNT_ID`          | Obrigatória | —       | identificador da conta Cloudflare                |
| `R2_ACCESS_KEY_ID`       | Obrigatória | —       | identificador da credencial limitada aos buckets |
| `R2_SECRET_ACCESS_KEY`   | Obrigatória | —       | segredo da credencial R2                         |
| `R2_PUBLIC_BUCKET_NAME`  | Obrigatória | —       | bucket de objetos publicamente servidos          |
| `R2_PRIVATE_BUCKET_NAME` | Obrigatória | —       | bucket de objetos privados                       |
| `R2_PUBLIC_BASE_URL`     | Obrigatória | —       | URL pública ou domínio customizado dos assets    |

Use credenciais com privilégio mínimo e acesso somente aos buckets necessários. Valores fictícios com formatos válidos permitem o bootstrap, mas uploads e remoções exigem buckets e credenciais reais.

### Aplicação e notificações

| Variável                                                | Regra       | Default                          | Uso                                             |
| ------------------------------------------------------- | ----------- | -------------------------------- | ----------------------------------------------- |
| `FRONTEND_URL`                                          | Obrigatória | —                                | base de redirecionamentos e links transacionais |
| `NODE_ENV`                                              | Default     | `development`                    | ambiente `development`, `production` ou `test`  |
| `NOTIFICATIONS_EMAIL_VERIFICATION_PATH`                 | Default     | `/verification-email`            | rota do frontend usada no link de verificação   |
| `NOTIFICATIONS_EMAIL_VERIFICATION_PROVIDER_TEMPLATE_ID` | Default     | `3`                              | template do provider para verificação de e-mail |
| `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`                  | Default     | `15`                             | validade do token de verificação                |
| `EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES`            | Default     | `60`                             | cooldown entre desafios de verificação          |
| `EMAIL_VERIFICATION_DAILY_LIMIT`                        | Default     | `5`                              | limite diário de desafios por e-mail            |
| `SUPPORT_URL`                                           | Condicional | `http://localhost:5173/support`¹ | link de suporte incluído nas mensagens          |

¹ `SUPPORT_URL` é obrigatória quando `MAIL_ENABLED=true`. O default só é aplicado quando o envio está desabilitado.

Essas variáveis são compartilhadas porque o fluxo de verificação pode ser iniciado pela API, em reenvios, ou pelo worker, ao consumir eventos persistidos na outbox.

## Somente API

### HTTP, autenticação e OAuth

As variáveis marcadas como condicionais abaixo são obrigatórias quando `PROCESS_ROLE=api` e opcionais para o worker.

| Variável                   | Regra       | Default | Uso                                                      |
| -------------------------- | ----------- | ------- | -------------------------------------------------------- |
| `APP_URL`                  | Condicional | —       | URL pública da API e issuer dos tokens                   |
| `PORT`                     | Default     | `3000`  | porta HTTP                                               |
| `JWT_ACCESS_SECRET`        | Condicional | —       | assinatura do access token; mínimo de 32 caracteres      |
| `JWT_REFRESH_SECRET`       | Condicional | —       | assinatura do refresh token; mínimo de 32 caracteres     |
| `JWT_ACCESS_EXPIRES_IN`    | Condicional | —       | duração do access token                                  |
| `JWT_REFRESH_EXPIRES_IN`   | Condicional | —       | duração do refresh token                                 |
| `GOOGLE_CLIENT_ID`         | Condicional | —       | client ID OAuth da aplicação Web                         |
| `GOOGLE_CLIENT_SECRET`     | Condicional | —       | client secret OAuth                                      |
| `GOOGLE_CALLBACK_URL`      | Condicional | —       | callback do login Google                                 |
| `GOOGLE_LINK_CALLBACK_URI` | Condicional | —       | callback para vincular Google a uma sessão autenticada   |
| `CSRF_ALLOWED_ORIGINS`     | Condicional | —       | lista CSV de origins completas aceitas pelo Origin Guard |

Use secrets JWT diferentes e aleatórios. Em produção, as callbacks precisam coincidir exatamente com as URIs autorizadas no Google Cloud Console.

### Rate limiting

| Variável                           | Regra    | Default | Uso                              |
| ---------------------------------- | -------- | ------- | -------------------------------- |
| `THROTTLE_DEFAULT_TTL`             | Default  | `60000` | janela global, em milissegundos  |
| `THROTTLE_DEFAULT_LIMIT`           | Default  | `20`    | limite global por janela         |
| `THROTTLE_AUTH_SIGNIN_TTL`         | Opcional | —       | janela especializada do login    |
| `THROTTLE_AUTH_SIGNIN_LIMIT`       | Opcional | —       | tentativas de login por janela   |
| `THROTTLE_AUTH_SIGNIN_BLOCKED_TTL` | Opcional | —       | bloqueio após exceder o login    |
| `THROTTLE_AUTH_SIGNUP_TTL`         | Opcional | —       | janela especializada do cadastro |
| `THROTTLE_AUTH_SIGNUP_LIMIT`       | Opcional | —       | cadastros permitidos por janela  |
| `THROTTLE_AUTH_SIGNUP_BLOCKED_TTL` | Opcional | —       | bloqueio após exceder o cadastro |

## Somente worker

### Filas, outbox e health

| Variável                              | Regra       | Default  | Uso                                             |
| ------------------------------------- | ----------- | -------- | ----------------------------------------------- |
| `BULLMQ_DEFAULT_CONCURRENCY`          | Default     | `5`      | concorrência dos consumers BullMQ               |
| `OUTBOX_POLL_INTERVAL_MS`             | Default     | `1000`   | intervalo entre polls da outbox                 |
| `OUTBOX_BATCH_SIZE`                   | Default     | `25`     | mensagens reclamadas por lote                   |
| `OUTBOX_CONCURRENCY`                  | Default     | `5`      | mensagens processadas simultaneamente           |
| `OUTBOX_LEASE_MS`                     | Default     | `30000`  | duração do lease de uma mensagem                |
| `OUTBOX_LEASE_RENEW_INTERVAL_MS`      | Default     | `10000`  | frequência de renovação do lease                |
| `EMAIL_ENQUEUE_RECONCILE_INTERVAL_MS` | Default     | `30000`  | intervalo da reconciliação PostgreSQL/BullMQ    |
| `EMAIL_ENQUEUE_RECONCILE_BATCH_SIZE`  | Default     | `100`    | intenções verificadas por reconciliação         |
| `EMAIL_ENQUEUE_STALE_AFTER_MS`        | Default     | `30000`  | idade mínima para uma intenção ser reconciliada |
| `WORKER_SHUTDOWN_TIMEOUT_MS`          | Default     | `30000`  | limite do encerramento gracioso                 |
| `WORKER_HEARTBEAT_INTERVAL_MS`        | Default     | `10000`  | frequência de atualização do heartbeat          |
| `WORKER_HEARTBEAT_TTL_MS`             | Default     | `30000`  | idade máxima aceita pelo health check           |
| `WORKER_INSTANCE_ID`                  | Operacional | hostname | identidade única da réplica                     |

O bootstrap rejeita configurações que violem estas relações:

- `OUTBOX_LEASE_RENEW_INTERVAL_MS < OUTBOX_LEASE_MS`;
- `OUTBOX_CONCURRENCY <= OUTBOX_BATCH_SIZE`;
- `WORKER_HEARTBEAT_INTERVAL_MS < WORKER_HEARTBEAT_TTL_MS`.

### E-mail transacional

| Variável                  | Regra       | Default                    | Uso                                                  |
| ------------------------- | ----------- | -------------------------- | ---------------------------------------------------- |
| `MAIL_ENABLED`            | Default     | `false`                    | habilita chamadas ao provider externo                |
| `MAIL_PROVIDER`           | Default     | `noop`                     | provider `noop` ou `brevo`                           |
| `MAIL_DEFAULT_FROM_EMAIL` | Condicional | —                          | remetente; obrigatório no worker com mail habilitado |
| `MAIL_DEFAULT_FROM_NAME`  | Opcional    | —                          | nome do remetente                                    |
| `BREVO_API_KEY`           | Condicional | —                          | obrigatória com worker, mail habilitado e Brevo      |
| `BREVO_API_BASE_URL`      | Default     | `https://api.brevo.com/v3` | endpoint do provider                                 |
| `BREVO_API_TIMEOUT_MS`    | Default     | `10000`                    | timeout das chamadas                                 |
| `BREVO_API_MAX_RETRIES`   | Default     | `2`                        | retries do cliente antes de falhar                   |

Para desenvolvimento e testes, mantenha `MAIL_ENABLED=false` e `MAIL_PROVIDER=noop`.

### Welcome e-mail

| Variável                               | Regra   | Default                       | Uso                                          |
| -------------------------------------- | ------- | ----------------------------- | -------------------------------------------- |
| `NOTIFICATIONS_DASHBOARD_PATH`         | Default | `/dashboard`                  | link do dashboard no template de boas-vindas |
| `NOTIFICATIONS_EMAIL_PREFERENCES_PATH` | Default | `/settings/email-preferences` | link de preferências no template             |
| `SUPPORT_URL_LABEL`                    | Default | `Central de ajuda`            | rótulo do link de suporte                    |

## Auditoria do exemplo

Na revisão desta referência:

- o schema Joi declarou 77 variáveis;
- as 77 variáveis aparecem em `.env.exemple`;
- `.env.exemple` contém ainda `APP_VERSION` e `WORKER_INSTANCE_ID`, consumidas fora do schema;
- nenhuma variável exigida pelo Joi ficou ausente;
- os sete campos obrigatórios do Cloudflare R2 estão presentes;
- os exemplos de credenciais usam placeholders explícitos e não se parecem com secrets reais.

Ao adicionar ou remover configuração, atualize no mesmo commit:

1. o schema Joi ou o consumidor operacional;
2. `.env.exemple`;
3. esta referência;
4. o guia afetado, quando o fluxo de desenvolvimento ou deploy mudar.
