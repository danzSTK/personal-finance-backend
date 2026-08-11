---
area: auth
type: integration
status: current
related:
  - ./architecture.md
  - ./flow/success.md
  - ./decisions/separated-outbox-events.md
  - ../../events/password-change.md
  - ../../notifications/README.md
---

# Notificações da alteração de senha

## Estado atual

A feature de auth persiste os fatos na outbox. O worker entrega os dois eventos
de segurança a handlers de notifications, que criam intenções idempotentes em
`email_messages` e adicionam os jobs à fila BullMQ.

| Evento                                         | Handler                                    | Efeito                         |
| ---------------------------------------------- | ------------------------------------------ | ------------------------------ |
| `auth.password-change.state-refresh-requested` | auth                                       | reconstrói Redis               |
| `auth.sessions.revoke-all-requested`           | auth                                       | remove sessões Redis           |
| `auth.password-change.changed`                 | `EnqueuePasswordChangedEmailHandler`       | cria `PASSWORD_CHANGED`        |
| `auth.password-change.block-started`           | `EnqueuePasswordChangeBlockedEmailHandler` | cria `PASSWORD_CHANGE_BLOCKED` |

Os dois eventos são reidratados pelo worker e escutados pelo `eventName`
canônico. Eventos locais que tenham chegado a `DEAD` antes desses handlers não
serão recuperados por backfill.

## Contratos produzidos

| Evento                               | Tipo                      | Template                     | Idempotência                                  |
| ------------------------------------ | ------------------------- | ---------------------------- | --------------------------------------------- |
| `auth.password-change.changed`       | `PASSWORD_CHANGED`        | `password-changed:v1`        | `email:password-change:event:<sourceEventId>` |
| `auth.password-change.block-started` | `PASSWORD_CHANGE_BLOCKED` | `password-change-blocked:v1` | `email:password-change:event:<sourceEventId>` |

As duas factories usam o identificador do fato fonte. A constraint única de
`email_messages.idempotency_key` decide corridas entre consumidores: o perdedor
relê a intenção vencedora em vez de criar uma segunda mensagem.

## Fluxo

```text
evento da outbox
  -> handler de notifications
  -> busca o destinatário atual em users
  -> valida params no catálogo Zod
  -> cria ou recupera email_message idempotente
  -> enqueue send-email-message { emailMessageId }
  -> worker recarrega a intenção
  -> valida chave, versão e params novamente
  -> MailService
  -> provider resolve chave + versão para ID externo sem sobrescrever sender
  -> Brevo aplica sender, assunto, preheader e HTML da versão hospedada
```

A chave, a versão e os parâmetros devem ser persistidos na intenção. O ID do
provider é resolvido pelo adapter e o job não duplica esse payload.

Os instantes dos eventos permanecem absolutos. Ao montar a intenção, notifications
converte `changed_at` e `blocked_until` para `DD/MM/AAAA às HH:mm` em
`America/Sao_Paulo`; por isso o resultado não depende do timezone do worker.
Ambos os templates v1 usam `security@danfy.app` como sender hospedado e
preheaders de até 35 caracteres.

## Eventos e e-mails

Um evento técnico de refresh nunca envia e-mail. Um bloqueio iniciado publica
um único evento de segurança, mesmo que a mesma requisição também publique o
pedido técnico de reconstrução Redis.

- `auth.password-change.changed` produz o e-mail informativo da alteração.
- `auth.password-change.block-started` produz o e-mail informativo do novo
  bloqueio.
- Requisições rejeitadas por um bloqueio já ativo não criam novo fato nem novo
  e-mail.

## Contexto permitido

Os eventos podem fornecer IP, localização aproximada, navegador, sistema
operacional, dispositivo e `blockedUntil` quando aplicável. Eles não carregam
senha, hash, JWT, JTI, cookie, User-Agent completo nem mutation token.

Falha no provider não pode desfazer a senha nem o bloqueio: o fato de auth já
foi confirmado antes do processamento da notificação.

Os contratos, handlers e HTMLs v1 estão implementados e validados. A publicação
no provider preserva chave e versão no backend; os IDs externos permanecem
somente na configuração de ambiente.
