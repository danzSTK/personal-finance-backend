---
area: platform
type: index
status: current
last_reviewed: 2026-10-30
related:
  - ./email-provider.md
  - ../../../notifications/README.md
---

# E-mail Transacional e Provedor

Este contexto documenta a arquitetura de envio de e-mails transacionais da Danfy, a integração com provedores externos (Brevo) e os contratos de envio.

## Mapa do Contexto

- [Email Provider](./email-provider.md) — Contratos do provedor de e-mail, variáveis de ambiente, fallback sem envio (`noop`) e troca de provedor por adapter.

## Responsabilidade da Pasta

Consulte esta pasta quando a tarefa envolver:
- Configuração de envio de e-mail ou credenciais de provedor (Brevo/SMTP).
- Criação ou alteração de adapters em `api/src/shared/mail/`.
- Comportamento de envio em desenvolvimento vs produção.
