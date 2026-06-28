---
area: notifications
type: index
status: implemented
---

# Notifications

Documentação do contexto de notificações.

O módulo de notifications é responsável por decidir quais mensagens transacionais devem existir, persistir a intenção idempotente de envio e delegar o envio real ao `MailService`.

## Infraestrutura Atual

- Intenções persistidas em `email_messages`.
- Fila BullMQ `notifications.email`.
- Job `send-email-message`.
- Worker `EmailMessageProcessor`.
- Envio por `MailService`, com provider real definido pela configuração de mail.

## Mapa

- [Templates de e-mail](./email-templates/README.md)
