---
area: platform
type: guide
status: current
related:
  - ./configuration.md
  - ./commands.md
  - ./architecture.md
  - ./platform/worker-operations.md
  - ./platform/queue-infrastructure.md
---

# Desenvolvimento local

Este é o caminho recomendado para preparar o Danfy Backend a partir de um clone limpo. PostgreSQL e as duas instâncias Redis rodam em containers; API e worker rodam localmente em modo watch.

## Requisitos de software

| Software       | Versão         | Uso                                       |
| -------------- | -------------- | ----------------------------------------- |
| Git            | atual          | clonar e versionar o repositório          |
| Node.js        | 22             | executar API, worker, migrations e testes |
| npm            | 10 ou superior | instalar dependências e executar scripts  |
| Docker Engine  | 24 ou superior | executar as dependências locais           |
| Docker Compose | plugin v2      | compor PostgreSQL e Redis                 |
| OpenSSL        | atual          | gerar secrets locais                      |

Confirme o ambiente:

```bash
git --version
node --version
npm --version
docker --version
docker compose version
openssl version
```

O repositório contém `api/.nvmrc`. Se você usa NVM:

```bash
cd api
nvm install
nvm use
cd ..
```

## Serviços e integrações

| Dependência         | Necessária para iniciar?      | Como usar localmente                                     |
| ------------------- | ----------------------------- | -------------------------------------------------------- |
| PostgreSQL 16       | sim                           | container `postgres`, porta `5432`                       |
| Redis 7             | sim                           | cache e sessões, porta `6379`                            |
| Redis 7 para BullMQ | sim                           | filas e heartbeat, porta `6381`                          |
| Google OAuth        | configuração exigida pela API | credenciais reais para testar login Google               |
| Cloudflare R2       | configuração exigida          | credenciais reais para testar upload e remoção de assets |
| Brevo               | não                           | mantenha `MAIL_ENABLED=false` e `MAIL_PROVIDER=noop`     |
| Frontend Danfy      | não                           | a API pode ser usada pelo Swagger ou outro cliente HTTP  |

O Redis do BullMQ é propositalmente separado do Redis de cache e sessões. Ele usa persistência AOF e política `noeviction`, necessárias para preservar os dados operacionais das filas.

## 1. Clonar o repositório

```bash
git clone https://github.com/danzSTK/personal-finance-backend.git
cd personal-finance-backend
```

## 2. Criar o ambiente local

Copie o exemplo versionado:

```bash
cp .env.exemple .env
```

O `.env` fica na raiz. Não o mova para `api/` e nunca o envie ao Git.

O exemplo está organizado por processo e identifica variáveis obrigatórias, condicionais, opcionais e com default. Consulte a [referência completa de configuração](./configuration.md) para entender quais campos pertencem à API, ao worker ou a ambos.

### Banco e Redis

Defina credenciais locais. Os valores precisam ser iguais para a aplicação e para os containers:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=danfy
POSTGRES_PASSWORD=uma_senha_local
POSTGRES_DB=danfy

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=outra_senha_local

BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6381
BULLMQ_REDIS_PASSWORD=uma_senha_bullmq_local
BULLMQ_REDIS_DB=0
```

### Autenticação

Gere secrets diferentes para access e refresh tokens:

```bash
openssl rand -hex 32
openssl rand -hex 32
```

Copie cada resultado para a variável correspondente:

```env
JWT_ACCESS_SECRET=<primeiro-secret>
JWT_REFRESH_SECRET=<segundo-secret>
```

Para testar o Google OAuth, crie um cliente do tipo aplicação Web no Google Cloud Console e registre:

```text
http://localhost:3000/auth/google/callback
http://localhost:3000/auth/providers/link/google/callback
```

Depois configure `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Valores fictícios permitem iniciar a API, mas o login Google não funcionará.

### Cloudflare R2

Crie buckets separados para objetos públicos e privados e um token limitado a esses buckets. Configure:

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCOUNT_ID=<account-id>
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_PUBLIC_BUCKET_NAME=<bucket-publico>
R2_PRIVATE_BUCKET_NAME=<bucket-privado>
R2_PUBLIC_BASE_URL=https://<dominio-publico-dos-assets>
```

A aplicação exige essas variáveis durante o bootstrap. Valores fictícios com URLs válidas servem para fluxos que não acessam storage; uploads e remoções de avatar exigem credenciais e buckets reais.

### E-mail

O modo local padrão não envia e-mails:

```env
MAIL_ENABLED=false
MAIL_PROVIDER=noop
```

Para testar o envio real, use `MAIL_ENABLED=true`, `MAIL_PROVIDER=brevo` e informe `BREVO_API_KEY` e um remetente verificado.

## 3. Instalar as dependências

Os comandos Node.js são executados em `api/`:

```bash
cd api
npm ci
npm run build
cd ..
```

`npm ci` instala exatamente as versões registradas no lockfile. O build inicial também prepara `dist/` para comandos operacionais como o health check do worker.

## 4. Iniciar PostgreSQL e Redis

Use explicitamente o Compose base e o arquivo de desenvolvimento versionado:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d postgres redis bullmq-redis
```

Confira se os três serviços estão saudáveis:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  ps
```

O arquivo `docker-compose.dev.yml` substitui o antigo fluxo implícito baseado em `docker-compose.override.yml`. A seleção explícita evita que configurações pessoais e ignoradas pelo Git alterem o comportamento documentado.

## 5. Executar as migrations

```bash
cd api
npm run migration:show
npm run migration:run
```

`migration:show` lista migrations aplicadas e pendentes. `migration:run` deve concluir sem erros antes da primeira inicialização.

## 6. Iniciar a API

No primeiro terminal, dentro de `api/`:

```bash
npm run start:dev
```

Espere o NestJS concluir o bootstrap sem erros de configuração ou conexão.

## 7. Iniciar o worker

No segundo terminal:

```bash
cd api
npm run start:worker:dev
```

O worker não abre porta HTTP. Ele deve permanecer em execução para despachar a outbox, reconciliar mensagens, consumir jobs e atualizar seu heartbeat.

## 8. Validar a instalação

Com API e worker ativos:

```bash
curl --fail http://localhost:3000/health/liveness
curl --fail http://localhost:3000/health/readiness
```

Abra a documentação da API em:

```text
http://localhost:3000/docs
```

Para validar o worker a partir de um terceiro terminal:

```bash
cd api
npm run health:worker
```

O comando deve terminar com exit code `0`. Uma falha informa qual dependência ou heartbeat não está saudável.

## Alternativa: aplicação inteira em containers

Esse modo usa a imagem de produção construída localmente e não possui hot reload:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d postgres redis bullmq-redis

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  build api

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  run --rm --no-deps api npm run migration:run:prod

docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  up -d --no-build api worker
```

## Encerrar o ambiente

Interrompa API e worker com `Ctrl+C`. Depois:

```bash
docker compose --env-file .env \
  -f docker-compose.yml \
  -f docker-compose.dev.yml \
  down
```

O volume do PostgreSQL é preservado. Use `down --volumes` somente quando quiser apagar intencionalmente todos os dados locais.

## Problemas comuns

### A aplicação não encontra o `.env`

Execute os scripts npm a partir de `api/`. A configuração procura o arquivo em `../.env` relativo ao diretório atual.

### A porta já está ocupada

Verifique `3000`, `5432`, `6379` e `6381`:

```bash
ss -ltnp
```

Pare a instância conflitante ou ajuste conscientemente as portas e as variáveis relacionadas.

### O worker está unhealthy

Confirme que PostgreSQL, Redis e BullMQ Redis estão saudáveis, que as migrations foram aplicadas e que `npm run start:worker:dev` continua ativo. O health check também exige um heartbeat recente.

### Google OAuth redireciona com erro

As URIs no Google Cloud Console devem coincidir exatamente com `GOOGLE_CALLBACK_URL` e `GOOGLE_LINK_CALLBACK_URI`, incluindo protocolo, porta e caminho.

### Upload de avatar falha

Confira endpoint, buckets, permissões do token R2 e `R2_PUBLIC_BASE_URL`. O token deve acessar somente os buckets necessários, mas precisa permitir as operações usadas pelo ciclo de vida dos assets.

## Próximos passos

- Consulte [Configuração por variáveis de ambiente](./configuration.md) ao separar env files ou alterar integrações.
- Consulte [Comandos principais](./commands.md) para qualidade, testes e migrations.
- Leia [Arquitetura e organização do código](./architecture.md) antes de alterar módulos.
- Consulte [Operação do worker](./platform/worker-operations.md) ao trabalhar com processamento assíncrono.
