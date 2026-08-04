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

A feature de auth já persiste na outbox os fatos necessários, mas ainda não
cria `email_messages` para eles.

| Evento                                         | Produzido | Handler técnico      | Handler de notificação |
| ---------------------------------------------- | --------- | -------------------- | ---------------------- |
| `auth.password-change.state-refresh-requested` | sim       | reconstrói Redis     | não se aplica          |
| `auth.sessions.revoke-all-requested`           | sim       | remove sessões Redis | não se aplica          |
| `auth.password-change.changed`                 | sim       | não se aplica        | ainda não implementado |
| `auth.password-change.block-started`           | sim       | não se aplica        | ainda não implementado |

Os dois eventos de segurança são reidratados pelo worker. Como ainda não existe
listener, o publicador assíncrono retorna erro e a outbox aplica retry até o
estado `DEAD`. Não haverá replay dos registros locais anteriores quando os
consumidores forem implementados.

## Responsabilidade da futura spec

A entrega de notificações deverá:

1. declarar tipos e template keys para senha alterada e bloqueio iniciado;
2. definir IDs de template por configuração e validá-los como inteiros
   positivos;
3. criar intenções idempotentes em `email_messages`;
4. registrar handlers para os dois eventos;
5. enfileirar somente o `emailMessageId` em `notifications.email`;
6. documentar templates, parâmetros e origem de cada campo;
7. testar retry, idempotência e ausência de dados sensíveis.

## Fluxo esperado

```text
evento da outbox
  -> handler de notifications
  -> cria ou recupera email_message idempotente
  -> enqueue send-email-message { emailMessageId }
  -> worker recarrega a intenção
  -> MailService
  -> provider configurado
```

O ID do template e os parâmetros devem ser persistidos na intenção. O job não
deve duplicar esse payload.

## Eventos e e-mails

Um evento técnico de refresh nunca envia e-mail. Um bloqueio iniciado publica
um único evento de segurança, mesmo que a mesma requisição também publique o
pedido técnico de reconstrução Redis.

- `auth.password-change.changed` produzirá o e-mail informativo da alteração.
- `auth.password-change.block-started` produzirá o e-mail informativo do novo
  bloqueio.
- Requisições rejeitadas por um bloqueio já ativo não criam novo fato nem novo
  e-mail.

## Contexto permitido

Os eventos podem fornecer IP, localização aproximada, navegador, sistema
operacional, dispositivo e `blockedUntil` quando aplicável. Eles não carregam
senha, hash, JWT, JTI, cookie, User-Agent completo nem mutation token.

Falha no provider não pode desfazer a senha nem o bloqueio: o fato de auth já
foi confirmado antes do processamento da notificação.
