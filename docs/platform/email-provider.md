---
area: platform
type: guide
status: current
related:
  - ../specs/platform/email-provider/specs/requirements.md
  - ../specs/platform/email-provider/specs/design.md
---

# Email Provider

O backend expõe `MailService` como fachada para envio de e-mails transacionais.

Essa infraestrutura não cria módulo `notifications`, fila, worker, consumer ou template de negócio. Ela apenas fornece uma porta estável para que módulos futuros possam solicitar envio de e-mail.

## Código

Arquivos principais:

```text
api/src/config/mail.config.ts
api/src/shared/mail/mail.module.ts
api/src/shared/mail/mail.service.ts
api/src/shared/mail/interfaces/mail-provider.interface.ts
api/src/shared/mail/adapters/brevo-mail.provider.ts
api/src/shared/mail/adapters/noop-mail.provider.ts
```

## Providers

Providers suportados nesta etapa:

- `noop`: não chama serviço externo;
- `brevo`: usa o SDK `@getbrevo/brevo`.

A troca futura de provider deve acontecer por adapter/classe ligada à porta `MailProvider`. Consumidores devem continuar chamando `MailService`.

## Configuração

```text
MAIL_ENABLED=false
MAIL_PROVIDER=noop
MAIL_DEFAULT_FROM_EMAIL=no-reply@seu-dominio.com
MAIL_DEFAULT_FROM_NAME=Personal Finance
BREVO_API_KEY=your_brevo_api_key
BREVO_API_BASE_URL=https://api.brevo.com/v3
BREVO_API_TIMEOUT_MS=10000
BREVO_API_MAX_RETRIES=2
```

Quando `MAIL_ENABLED=true` e `MAIL_PROVIDER=brevo`, `BREVO_API_KEY` e `MAIL_DEFAULT_FROM_EMAIL` são obrigatórios.

## Uso Futuro

Módulos futuros devem injetar `MailService`:

```ts
await this.mailService.send({
  to: [{ email: userEmail }],
  subject: 'Assunto',
  html: '<p>Mensagem</p>',
});
```

O serviço aplica o remetente padrão quando `from` não é informado.

## Segurança

- Não logar `BREVO_API_KEY`.
- Não expor SDK da Brevo fora do adapter.
- Não colocar tokens ou segredos em `params`.
- Resolver ownership/dados do usuário antes de solicitar envio.

## Erros

Falhas são traduzidas para `MailError`, com códigos estáveis:

```text
MAIL_INVALID_PAYLOAD
MAIL_PROVIDER_UNAVAILABLE
MAIL_PROVIDER_REJECTED
MAIL_PROVIDER_TIMEOUT
MAIL_PROVIDER_UNKNOWN
```

`MailError.retryable` indica se uma fila/worker futuro pode tentar novamente.

## Fora Do Escopo

Esta infraestrutura não decide quando enviar e-mail. Consumers, filas, workers, eventos e templates pertencem a specs de features futuras.
