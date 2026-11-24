# Módulo Notifications — Instruções Locais

Este módulo é responsável pela composição, agendamento e envio de notificações da plataforma (e-mails transacionais via provedor Brevo e enfileiramento BullMQ).

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/notifications/README.md` — Índice e modelo de templates.
- `docs/notifications/email-templates/` — Modelos de e-mail e design system Danfy.
- `docs/platform/email/` — Configuração e contratos do provedor de e-mail (Brevo).
- `docs/platform/workers/` — Infraestrutura de filas BullMQ e operação de workers.

## Regras de Fronteira e Invariantes
- **Envio Assíncrono:** E-mails transacionais devem ser sempre despachados via filas BullMQ (`NotificationsQueues.EMAIL`) e processados no Worker, nunca bloqueando requisições síncronas da API.
- **Isolamento de Templates:** Templates de e-mail seguem o design system documentado em `docs/notifications/email-templates/design-system.md`.
- **Reconciliação:** O reconciliador periódico `EmailMessageEnqueueReconciler` reprocessa mensagens presas em `PENDING_ENQUEUE`.
