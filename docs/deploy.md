# Guia de Deploy — VPS (Ubuntu 22.04)

## Visão Geral

Este guia descreve como subir a API em um ambiente Linux (Ubuntu 22.04) utilizando **Docker Compose** para orquestrar os containers e **NGINX** como proxy reverso com SSL.

> **⚠️ Pré-requisitos de conhecimento**
>
> Este documento **não** é um tutorial de Docker, Docker Compose ou Linux. Ele pressupõe que você já tem familiaridade básica com:
> - Navegação e execução de comandos no terminal Linux
> - Conceitos fundamentais de Docker e Docker Compose (containers, volumes, networks, variáveis de ambiente)
> - Configuração básica de NGINX (server blocks, proxy_pass)
>
> Os comandos listados aqui são sugestões. **Leia e entenda cada um antes de executar.**

A stack é composta por:

| Serviço | Tecnologia | Função |
|---|---|---|
| API | NestJS (Node.js 22) | HTTP, casos de uso, producers e escrita da outbox |
| Worker | NestJS (Node.js 22) | Outbox, eventos, reconciliação e jobs BullMQ |
| Banco de dados | PostgreSQL 16 | Persistência de dados |
| Cache e sessões | Redis 7 | Cache, sessões e rate limit |
| Filas | Redis 7 | Backend dedicado do BullMQ com política `noeviction` |
| Proxy reverso | NGINX (host) | SSL/TLS + roteamento de tráfego |

---

## Arquitetura

```
Internet
  │
  ▼
NGINX (host) — porta 80 → redireciona para HTTPS
              — porta 443 → proxy reverso com SSL (Let's Encrypt)
                  │
                  ▼
           Docker Compose
           ┌──────────────────────────────────────┐
           │  API (NestJS)       — porta 3000     │
           │  Worker (NestJS)    — sem porta HTTP │
           │  Redis cache/sessão — porta 6379     │
           │  Redis BullMQ       — porta 6379 int. │
           │  PostgreSQL 16      — porta 5432     │
           └──────────────────────────────────────┘
```

> **Nota:** O NGINX roda diretamente no host (não em container). Os serviços da aplicação rodam em containers Docker na mesma rede interna (`app-network`). A API só é acessível externamente via NGINX. O Redis de BullMQ deve ficar separado do Redis de cache/sessões para evitar eviction de chaves de jobs.

---

## Requisitos da VM

| Recurso | Mínimo recomendado |
|---|---|
| Sistema Operacional | Ubuntu 22.04 LTS |
| CPU | 1 vCPU |
| RAM | 1 GB (a stack usa ~1 GB no total) |
| Disco | 20 GB |
| Porta 80 | Aberta no firewall (HTTP) |
| Porta 443 | Aberta no firewall (HTTPS) |

### Software necessário no host

- **Docker** (Engine 24+)
- **Docker Compose** (plugin v2)
- **NGINX**
- **Certbot** (com plugin para NGINX)

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

### Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

---

## 2. Clonar o repositório

```bash
git clone <url-do-repositorio> app
cd app
```

> Substitua `<url-do-repositorio>` pela URL do seu repositório Git (HTTPS ou SSH).

---

## 3. Configurar variáveis de ambiente

Na raiz do projeto, crie o arquivo `.env` a partir do exemplo disponível:

```bash
cp .env.exemple .env
nano .env
```

Preencha **todas** as variáveis obrigatórias. As mais críticas são:

```env
# PostgreSQL
POSTGRES_USER=seu_usuario
POSTGRES_PASSWORD=senha_forte_aqui
POSTGRES_DB=nome_do_banco

# Redis
REDIS_PASSWORD=senha_forte_redis

# Redis dedicado para BullMQ
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

## 4. Subir a aplicação com Docker Compose

```bash
docker compose up -d --build
```

Verifique se todos os containers estão rodando:

```bash
docker compose ps
```

Você deve ver os serviços principais com status `running`/`healthy`:

```
NAME                     STATUS
personal-finance-api     Up
personal-finance-worker  Up (healthy)
personal-finance-db      Up
personal-finance-redis   Up
personal-finance-bullmq-redis Up
```

Acompanhe os logs da API em tempo real:

```bash
docker compose logs -f api
```

Acompanhe o processamento assíncrono:

```bash
docker compose logs -f worker
```

API e worker usam a mesma imagem, mas commands e `PROCESS_ROLE` distintos. Somente a API publica porta. Em produção, injete JWT/OAuth/CSRF apenas na API e credenciais de mail/Brevo apenas no worker; ambos ainda precisam das configurações compartilhadas de PostgreSQL, Redis, BullMQ, storage e URLs usadas pelas intenções.

---

## 5. Configurar NGINX como proxy reverso

O NGINX deve ser configurado para:

1. Escutar na porta **80** e redirecionar todo o tráfego para **HTTPS** (301).
2. Escutar na porta **443** com o certificado SSL provido pelo Certbot.
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

## 6. Gerar certificado SSL com Certbot

Com o NGINX configurado e o domínio apontando para o IP da VPS, rode:

```bash
sudo certbot --nginx -d seu-dominio.com
```

O Certbot irá:
- Validar o domínio via HTTP
- Emitir o certificado Let's Encrypt
- Ajustar automaticamente a configuração do NGINX para HTTPS

Verifique a renovação automática:

```bash
sudo certbot renew --dry-run
```

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

| Ação | Comando |
|---|---|
| Ver logs da API | `docker compose logs -f api` |
| Ver logs do worker | `docker compose logs -f worker` |
| Reiniciar a API | `docker compose restart api` |
| Reiniciar o worker | `docker compose restart worker` |
| Parar tudo | `docker compose down` |
| Atualizar a aplicação | `git pull && docker compose up -d --build` |
| Acessar o banco | `docker exec -it personal-finance-db psql -U <POSTGRES_USER> -d <POSTGRES_DB>` |
| Acessar o Redis CLI | `docker exec -it personal-finance-redis redis-cli -a <REDIS_PASSWORD>` |
| Acessar o Redis BullMQ CLI | `docker exec -it personal-finance-bullmq-redis redis-cli -a <BULLMQ_REDIS_PASSWORD>` |
