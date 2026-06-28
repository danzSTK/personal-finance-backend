---
area: platform
feature: email-provider
type: spec-design
status: draft
related:
  - ./requirements.md
  - ./decisions.md
---

# Design - Email Provider

## Arquitetura

Criar infraestrutura compartilhada em:

```text
api/src/shared/mail/
├── adapters/
│   └── brevo-mail.provider.ts
├── constants/
│   └── mail.constants.ts
├── errors/
│   ├── mail-error.ts
│   └── mail-error.mapper.ts
├── interfaces/
│   ├── mail-provider.interface.ts
│   └── mail-message.interface.ts
├── mail.module.ts
├── mail.service.ts
└── README.md
```

Criar configuração em:

```text
api/src/config/mail.config.ts
```

Registrar o módulo compartilhado em:

```text
api/src/app/app.module.ts
```

O módulo deve expor `MailService` para módulos futuros. Nenhum módulo `notifications`, consumer, fila ou handler de evento será criado nesta spec.

## Dependências

Preferência inicial: usar HTTP nativo via `fetch` do Node.js 22 para chamar a API transacional da Brevo.

Motivos:

- evita SDK como dependência extra;
- mantém o adapter fino;
- facilita trocar provedor;
- reduz superfície de atualização externa.

Se a implementação decidir usar SDK oficial da Brevo, isso deve ser registrado em `decisions.md` antes de codar.

## Configuração

Criar `mail.config.ts` com namespace `mail`.

Campos propostos:

```ts
{
  enabled: boolean;
  provider: 'brevo' | 'smtp' | 'noop';
  defaultSender: {
    email: string;
    name?: string;
  };
  brevo: {
    apiKey?: string;
    baseUrl: string;
    timeoutMs: number;
  };
}
```

## Variáveis De Ambiente

Adicionar ao schema Joi:

```text
MAIL_ENABLED
MAIL_PROVIDER
MAIL_DEFAULT_FROM_EMAIL
MAIL_DEFAULT_FROM_NAME
BREVO_API_KEY
BREVO_API_BASE_URL
BREVO_API_TIMEOUT_MS
```

Defaults sugeridos:

```text
MAIL_ENABLED=false
MAIL_PROVIDER=noop
BREVO_API_BASE_URL=https://api.brevo.com/v3
BREVO_API_TIMEOUT_MS=10000
```

Validações:

- `MAIL_PROVIDER` deve aceitar apenas `brevo`, `smtp` ou `noop`;
- `MAIL_DEFAULT_FROM_EMAIL` deve ser e-mail válido quando `MAIL_ENABLED=true`;
- `BREVO_API_KEY` deve ser obrigatório quando `MAIL_ENABLED=true` e `MAIL_PROVIDER=brevo`;
- `BREVO_API_TIMEOUT_MS` deve ser inteiro positivo;
- `MAIL_DEFAULT_FROM_NAME` deve ser opcional.

## Contrato De Mensagem

Criar interface interna:

```ts
export interface MailAddress {
  email: string;
  name?: string;
}

export interface SendMailInput {
  to: MailAddress[];
  subject: string;
  from?: MailAddress;
  replyTo?: MailAddress;
  html?: string;
  text?: string;
  templateId?: string | number;
  params?: Record<string, unknown>;
  tags?: string[];
  metadata?: Record<string, string>;
}

export interface SendMailResult {
  provider: string;
  messageId?: string;
  accepted: number;
}
```

Regras:

- `to` deve ter pelo menos um destinatário;
- `subject` deve ser obrigatório para envios sem template, e opcional se o provedor/template permitir assunto próprio;
- pelo menos um entre `templateId`, `html` ou `text` deve existir;
- se `from` não for informado, usar `mail.defaultSender`;
- `params` deve ser serializável em JSON;
- `metadata` não deve carregar segredos.

## Porta De Provider

Criar:

```ts
export abstract class MailProvider {
  abstract send(input: SendMailInput): Promise<SendMailResult>;
}
```

O binding ativo fica no `MailModule`:

```text
MailProvider -> BrevoMailProvider
MailProvider -> NoopMailProvider
```

SMTP será desenhado como adapter futuro. A spec atual deve deixar a porta pronta para SMTP, mas não precisa implementar SMTP se o escopo aprovado for Brevo API + noop.

## MailService

`MailService` será a fachada injetável:

```ts
@Injectable()
export class MailService {
  async send(input: SendMailInput): Promise<SendMailResult>;
}
```

Responsabilidades:

- validar payload mínimo;
- aplicar remetente padrão;
- chamar `MailProvider`;
- mapear erros para `MailError`;
- não conhecer detalhes HTTP da Brevo.

`MailService` não deve:

- montar templates de negócio;
- decidir quando enviar e-mail;
- consumir eventos;
- enfileirar jobs;
- conhecer módulo `notifications`.

## Adapter Brevo

Adapter:

```text
api/src/shared/mail/adapters/brevo-mail.provider.ts
```

Responsabilidades:

- traduzir `SendMailInput` para payload da Brevo;
- chamar endpoint transacional de envio;
- aplicar timeout;
- extrair `messageId` quando disponível;
- classificar erros HTTP em retentáveis ou permanentes;
- sanitizar logs/erros.

Endpoint conceitual:

```text
POST /smtp/email
```

Headers conceituais:

```text
api-key: <BREVO_API_KEY>
content-type: application/json
```

Mapeamento de campos:

- `to` -> `to`;
- `from` -> `sender`;
- `replyTo` -> `replyTo`;
- `subject` -> `subject`;
- `html` -> `htmlContent`;
- `text` -> `textContent`;
- `templateId` -> `templateId`;
- `params` -> `params`;
- `tags` -> `tags`.

Regra de precedência:

- se `templateId` existir, o adapter envia `templateId` e `params`;
- `html` e `text` podem continuar no contrato para providers que aceitem fallback, mas Brevo deve priorizar template;
- se `templateId` não existir, usar `html` e/ou `text`.

## Noop Provider

Criar `NoopMailProvider` para ambientes de teste/local quando `MAIL_ENABLED=false` ou `MAIL_PROVIDER=noop`.

Responsabilidades:

- validar que o serviço chamou provider;
- retornar resultado determinístico;
- não fazer chamada externa;
- não mascarar erros de validação do `MailService`.

## Erros

Criar erro de plataforma:

```ts
export class MailError extends Error {
  readonly code: MailErrorCode;
  readonly retryable: boolean;
}
```

Códigos iniciais:

```text
mail.invalid_payload
mail.provider_unavailable
mail.provider_rejected
mail.provider_timeout
mail.provider_unknown
```

Classificação sugerida:

- 408, 429 e 5xx: retentável;
- 400, 401, 403, 404 e validação de payload: não retentável;
- timeout: retentável;
- erro desconhecido de rede: retentável por padrão, com log sanitizado.

Esses erros são internos. Esta spec não altera contrato HTTP.

## Segurança

- Nunca logar `BREVO_API_KEY`.
- Evitar logar corpo completo de e-mail.
- Não enviar tokens, refresh tokens ou segredos em `params`.
- Módulos futuros devem resolver ownership antes de solicitar envio.
- Dados pessoais em logs devem ser mínimos.

## Relação Com BullMQ

Esta spec não cria filas ou consumers.

Um worker futuro poderá injetar `MailService` e chamar `send`. Retry operacional deverá ser responsabilidade do worker/fila, enquanto `MailError.retryable` informa se a falha pode ser retentada.

## Relação Com Notifications

Esta spec não cria módulo `notifications`.

Um futuro `NotificationsModule` poderá:

- montar templates de negócio;
- reagir a eventos;
- enfileirar jobs;
- chamar `MailService` dentro de workers ou use cases.

## Testes

Testes esperados:

- `mail.config.spec.ts` para defaults e validações condicionais;
- `mail.service.spec.ts` para validação de payload, remetente padrão e delegação ao provider;
- `brevo-mail.provider.spec.ts` com `fetch` mockado para sucesso, 4xx, 5xx e timeout;
- `mail-error.mapper.spec.ts` para classificação retryable/permanent;
- `mail.module.spec.ts` para binding de provider sem chamada externa.

Não fazer chamada real para Brevo em testes automatizados.

## Documentação

Criar ou atualizar:

```text
docs/platform/email-provider.md
docs/platform/README.md
.env.exemple
```

A documentação deve explicar:

- como configurar Brevo;
- como desabilitar envio real;
- como trocar provider;
- como um módulo futuro deve usar `MailService`;
- que consumers e filas ficam fora desta spec.

## Impacto Em API/Swagger

Sem impacto em endpoints HTTP ou Swagger.

## Impacto Em Banco/Migrations

Sem alterações de banco relacional e sem migrations.
