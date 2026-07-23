# Guia de Deploy — VPS (Ubuntu 22.04)

## Visão Geral

Este guia descreve a arquitetura e os requisitos operacionais do host de produção. A implantação da aplicação é automatizada pelo GitHub Actions e pelo executor restrito instalado na VPS; o fluxo completo está em [Releases e entrega contínua](./platform/continuous-delivery.md).

> **⚠️ Pré-requisitos de conhecimento**
>
> Este documento **não** é um tutorial de Docker, Docker Compose ou Linux. Ele pressupõe que você já tem familiaridade básica com:
>
> - Navegação e execução de comandos no terminal Linux
> - Conceitos fundamentais de Docker e Docker Compose (containers, volumes, networks, variáveis de ambiente)
> - Configuração básica de NGINX (server blocks, proxy_pass)
>
> Os comandos listados aqui são sugestões. **Leia e entenda cada um antes de executar.**

A stack é composta por:

| Serviço         | Tecnologia           | Função                                               |
| --------------- | -------------------- | ---------------------------------------------------- |
| API             | NestJS (Node.js 22)  | HTTP, casos de uso, producers e escrita da outbox    |
| Worker          | NestJS (Node.js 22)  | Outbox, eventos, reconciliação e jobs BullMQ         |
| Banco de dados  | PostgreSQL 16 no RDS | Persistência de dados externa ao Compose             |
| Cache e sessões | Redis 7              | Cache, sessões e rate limit                          |
| Filas           | Redis 7              | Backend dedicado do BullMQ com política `noeviction` |
| Proxy reverso   | NGINX (host)         | TLS de origem + roteamento de tráfego                |

---

## Arquitetura

```
Internet
  │
  ▼
Cloudflare — certificado público na borda
  │
  │ HTTPS
  ▼
NGINX (host) — porta 80 → redireciona para HTTPS
              — porta 443 → certificado Cloudflare Origin CA
                  │
                  ▼
           Docker Compose                         AWS
           ┌──────────────────────────────────────┐   ┌─────────────────┐
           │  API (NestJS)       — porta 3000     │──>│ PostgreSQL RDS  │
           │  Worker (NestJS)    — sem porta HTTP │──>│ endpoint no env │
           │  Redis cache/sessão — porta 6379     │   └─────────────────┘
           │  Redis BullMQ       — porta 6379 int. │
           └──────────────────────────────────────┘
```

> **Nota:** O NGINX roda diretamente no host (não em container). API, worker e Redis rodam em containers na rede interna (`app-network`), enquanto PostgreSQL permanece no RDS e é acessado pelo endpoint definido em `POSTGRES_HOST`. A API é publicada pelo proxy da Cloudflare e encaminhada ao NGINX com o modo SSL/TLS `Full (strict)`. O Redis de BullMQ deve ficar separado do Redis de cache/sessões para evitar eviction de chaves de jobs.

> Em produção, execute Compose somente com `-f docker-compose.yml`. O arquivo versionado `docker-compose.dev.yml` adiciona build local, PostgreSQL e portas de desenvolvimento e não deve participar do deploy.

---

## Requisitos da VM

| Recurso             | Mínimo recomendado                |
| ------------------- | --------------------------------- |
| Sistema Operacional | Ubuntu 22.04 LTS                  |
| CPU                 | 1 vCPU                            |
| RAM                 | 1 GB (a stack usa ~1 GB no total) |
| Disco               | 20 GB                             |
| Porta 80            | Aberta no firewall (HTTP)         |
| Porta 443           | Aberta no firewall (HTTPS)        |

### Software necessário no host

- **Docker** (Engine 24+)
- **Docker Compose** (plugin v2)
- **NGINX**
- **Certificado Cloudflare Origin CA** e sua chave privada instalados fora do repositório

---

## 1. Preparar o servidor

Atualize o sistema e instale as dependências:

```bash
sudo apt update && sudo apt upgrade -y
```

### Instalar Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

Verifique:

```bash
docker --version
docker compose version
```

### Instalar NGINX

```bash
sudo apt install nginx -y
```

---

## 2. Preparar o executor de deploy

O fluxo normal de produção não clona o backend nem compila código na VPS. O host recebe imagens previamente construídas, analisadas e publicadas no GHCR.

O executor versionado no repositório de infraestrutura deve estar instalado em:

```text
/usr/local/sbin/danfy-backend-deploy
```

O usuário remoto `deploy`:

- não pertence ao grupo `docker`;
- acessa o host somente pela rede Tailscale;
- possui `sudo` sem senha restrito ao executor;
- não pode executar comandos Docker arbitrários.

O executor mantém os arquivos Compose, o estado da versão atual e anterior e os env files de API e worker. Provisionamento e atualização desse componente pertencem ao repositório `danfy-infra`.

---

## 3. Configurar variáveis de ambiente

Os env files são mantidos pelo executor fora do checkout da aplicação. Use `.env.exemple` como referência de valores seguros e consulte a [matriz de configuração por processo](./configuration.md) para separar variáveis compartilhadas, somente API e somente worker. As mais críticas são:

```env
# PostgreSQL
POSTGRES_HOST=endpoint-do-rds.amazonaws.com
POSTGRES_PORT=5432
POSTGRES_USER=seu_usuario
POSTGRES_PASSWORD=senha_forte_aqui
POSTGRES_DB=nome_do_banco

# Redis
REDIS_PASSWORD=senha_forte_redis

# Redis dedicado para BullMQ
BULLMQ_REDIS_HOST=bullmq-redis
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=senha_forte_bullmq
BULLMQ_REDIS_DB=0
BULLMQ_PREFIX=personal-finance

# Worker/outbox
OUTBOX_POLL_INTERVAL_MS=1000
OUTBOX_BATCH_SIZE=25
OUTBOX_CONCURRENCY=5
OUTBOX_LEASE_MS=30000
OUTBOX_LEASE_RENEW_INTERVAL_MS=10000
WORKER_SHUTDOWN_TIMEOUT_MS=30000
WORKER_HEARTBEAT_INTERVAL_MS=10000
WORKER_HEARTBEAT_TTL_MS=30000

# JWT (gere strings longas e aleatórias)
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://api.danfy.app/auth/google/callback
GOOGLE_LINK_CALLBACK_URI=https://api.danfy.app/auth/providers/link/google/callback

# Cloudflare R2
R2_ENDPOINT=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BUCKET_NAME=...
R2_PRIVATE_BUCKET_NAME=...
R2_PUBLIC_BASE_URL=...

# Aplicação
NODE_ENV=production
PORT=3000
```

> ⚠️ **Nunca** comite o arquivo `.env` no repositório. Ele está listado no `.gitignore`.

Dica para gerar segredos seguros:

```bash
openssl rand -base64 48
```

---

## 4. Implantar a aplicação

O caminho oficial começa com uma GitHub Release estável. O Backend CD:

1. constrói e analisa as imagens AMD64 e ARM64;
2. publica um manifest multi-arquitetura;
3. aguarda aprovação do Environment `production`;
4. conecta ao host via Tailscale;
5. chama o executor com imagem por digest, versão e commit;
6. executa migrations e ativa API e worker;
7. valida health checks internos e readiness pública;
8. tenta rollback para `previous` quando apenas o check externo falha.

Não use `git pull`, `docker compose up --build` ou uma tag mutável como mecanismo de atualização. O host executa o artefato aprovado pelo pipeline e identificado por digest.

Para consultar o estado sem implantar:

```bash
sudo -n /usr/local/sbin/danfy-backend-deploy status
```

API e worker usam a mesma imagem, mas commands e `PROCESS_ROLE` distintos. Somente a API publica porta. JWT, OAuth e CSRF pertencem à API; mail e Brevo pertencem ao worker; ambos ainda precisam das configurações compartilhadas de PostgreSQL, Redis, BullMQ, storage e URLs usadas pelas intenções.

---

## 5. Configurar NGINX como proxy reverso

O NGINX deve ser configurado para:

1. Escutar na porta **80** e redirecionar todo o tráfego para **HTTPS** (301).
2. Escutar na porta **443** com o certificado de origem emitido pela Cloudflare.
3. Fazer `proxy_pass` para `http://localhost:3000` (onde a API está exposta).

### Headers obrigatórios

A aplicação utiliza um módulo de **session tracking** que captura metadados das requisições (IP real do cliente, User-Agent, geolocalização). Para que isso funcione corretamente atrás do proxy, o NGINX **deve** repassar os seguintes headers para a API:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

> Sem esses headers, a aplicação receberá o IP interno do container (`127.0.0.1`) em vez do IP real do cliente, o que quebrará o rastreamento de sessão e a geolocalização.

Crie o arquivo de configuração do site (exemplo com nome do domínio):

```bash
sudo nano /etc/nginx/sites-available/meu-dominio.conf
```

Após configurar, habilite o site e teste:

```bash
sudo ln -s /etc/nginx/sites-available/meu-dominio.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Configurar o certificado de origem da Cloudflare

Crie o certificado no painel da Cloudflare em **SSL/TLS → Origin Server** e inclua os hostnames atendidos pelo NGINX.

Instale o certificado e sua chave privada no host, fora do repositório e com permissões restritas. A configuração do server block deve apontar para esses arquivos:

```nginx
ssl_certificate     /caminho/para/cloudflare-origin.pem;
ssl_certificate_key /caminho/para/cloudflare-origin.key;
```

Depois de configurar:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

No painel da Cloudflare, mantenha o modo SSL/TLS em **Full (strict)**. O certificado de origem protege a conexão Cloudflare → NGINX e não substitui o certificado público apresentado pela borda aos clientes.

Nunca armazene a chave privada no Git. Acompanhe a validade do certificado e planeje sua rotação antes do vencimento.

---

## 7. Health Checks

A API expõe dois endpoints de verificação de saúde, **sem autenticação** e excluídos do rate limiting:

### `GET /health/liveness`

Verifica se o processo da API está **vivo** — ou seja, se o container subiu e está respondendo. Não verifica dependências externas.

```bash
curl https://seu-dominio.com/health/liveness
```

Resposta esperada (`200 OK`):

```json
{ "status": "ok", "info": {}, "error": {}, "details": {} }
```

### `GET /health/readiness`

Verifica se a aplicação está **pronta para receber tráfego**. Checa ativamente:

- Conectividade com o **PostgreSQL** (ping com timeout de 300ms)
- Uso de **memória heap** da API (limite: 300 MB)
- Conectividade com o **Redis**

```bash
curl https://seu-dominio.com/health/readiness
```

Resposta esperada (`200 OK`) quando tudo está saudável:

```json
{
  "status": "ok",
  "info": {
    "postgres": { "status": "up" },
    "memory_heap": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

Se qualquer dependência falhar, o endpoint retorna `503 Service Unavailable` com detalhes do componente que falhou.

> Use o **liveness** para configurar o health check do NGINX ou de um monitor de uptime. Use o **readiness** para diagnosticar problemas de conectividade entre os serviços.

### Worker

O worker não abre endpoint HTTP. O Compose executa dentro do container:

```bash
npm run health:worker
```

O comando verifica PostgreSQL, os dois Redis e o heartbeat da instância, retornando código diferente de zero em falha. O runbook com consultas e alertas está em [Worker operations](./platform/worker-operations.md).

## 8. Rollout E Rollback

Para migrar sem janela sem consumers:

1. aplique migrations compatíveis, quando existirem;
2. publique a imagem única;
3. inicie o worker novo e valide heartbeat, outbox e BullMQ;
4. substitua a API pela root sem consumers;
5. monitore backlog, mensagens `DEAD` e jobs falhos.

Uma sobreposição curta com a versão anterior é tolerada por `SKIP LOCKED`, leases e idempotência. No rollback, pare o worker novo, restaure a imagem anterior e preserve PostgreSQL, Redis cache e Redis BullMQ. Não remova volumes nem limpe filas/outbox.

---

## Comandos úteis

| Ação                           | Caminho                                                                  |
| ------------------------------ | ------------------------------------------------------------------------ |
| Consultar o estado implantado  | `sudo -n /usr/local/sbin/danfy-backend-deploy status`                    |
| Validar acesso do GitHub       | workflow manual `production-connectivity.yml`                            |
| Consultar logs de uma release  | artifact `production-deploy-<versão>` no Backend CD                      |
| Implantar uma versão           | publicar uma GitHub Release estável e aprovar o Environment `production` |
| Restaurar a versão anterior    | executor `rollback previous`, seguindo o procedimento operacional        |
| Investigar o PostgreSQL no RDS | ferramentas e credenciais operacionais do ambiente, fora do Compose      |

Operações que alteram o runtime devem passar pelo executor. Não entregue acesso direto ao Docker para o usuário `deploy`.
