---
area: notifications
type: email-template-index
status: implemented
---

# Email Templates

Catálogo dos templates de e-mail usados pela aplicação.

Cada template deve documentar:

- key interna;
- provider;
- id no provider;
- tipo de e-mail;
- caso de uso;
- trigger;
- parâmetros obrigatórios;
- parâmetros opcionais;
- origem dos parâmetros;
- regra de idempotência;
- observações de segurança.

## Templates

| Key                                   | Provider | Provider template id | Tipo         | Status      |
| ------------------------------------- | -------- | -------------------- | ------------ | ----------- |
| [`welcome-email`](./welcome-email.md) | Brevo    | `2`                  | Transacional | implemented |
