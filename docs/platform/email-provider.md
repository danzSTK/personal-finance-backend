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

A troca futura de provider deve acontecer por adapter/classe ligada à porta `MailProvider`. Consumidores devem continuar chamando `MailService` com referência lógica de template.

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
BREVO_TEMPLATE_WELCOME_EMAIL_V1_ID=<inteiro-positivo>
BREVO_TEMPLATE_EMAIL_VERIFICATION_V1_ID=<inteiro-positivo>
```

Quando o worker usa `MAIL_ENABLED=true` e `MAIL_PROVIDER=brevo`, a API key, o
remetente e os mappings das versões ativas são obrigatórios. API HTTP e provider
`noop` não exigem mappings Brevo.

## Contrato De Template

Consumers enviam chave, versão e parâmetros; não enviam `templateId`:

```ts
await this.mailService.send({
  to: [{ email: userEmail }],
  template: { key: "welcome-email", version: 1 },
  params,
});
```

O serviço aplica o remetente padrão. O `BrevoMailProvider` resolve a referência
em `mail.config` imediatamente antes de chamar o SDK. O provider `noop` valida a
referência sem exigir ID externo.

HTML/texto livre continuam disponíveis para mensagens que não usam template
hospedado.

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
MAIL_TEMPLATE_MAPPING_MISSING
```

`MailError.retryable` indica se uma fila/worker futuro pode tentar novamente.
Mapping ausente é configuração permanente para aquela tentativa e não deve gerar
retry automático.

## Fora Do Escopo

Esta infraestrutura não decide quando enviar e-mail. Consumers, filas, workers, eventos e templates pertencem a specs de features futuras.
