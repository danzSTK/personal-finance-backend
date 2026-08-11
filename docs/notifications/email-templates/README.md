---
area: notifications
type: email-template-index
status: current
---

# Email Templates

Catálogo dos templates de e-mail usados pela aplicação.

Cada template deve documentar:

- key interna;
- versão;
- caminho do HTML;
- tipo de e-mail;
- caso de uso;
- trigger;
- parâmetros obrigatórios;
- parâmetros opcionais;
- origem dos parâmetros;
- regra de idempotência;
- observações de segurança.

O ID de um provider não faz parte da identidade do template. A infraestrutura
resolve `template_key + template_version` usando configuração do ambiente.

## Templates

| Key                                                       | Versão ativa | Tipo         | Fonte HTML                                                     | Status      |
| --------------------------------------------------------- | ------------ | ------------ | -------------------------------------------------------------- | ----------- |
| [`email-verification`](./email-verification.md)           | `1`          | Transacional | `api/email-templates/email-verification/v1/template.html`      | implemented |
| [`password-change-blocked`](./password-change-blocked.md) | `1`          | Segurança    | `api/email-templates/password-change-blocked/v1/template.html` | implemented |
| [`password-changed`](./password-changed.md)               | `1`          | Segurança    | `api/email-templates/password-changed/v1/template.html`        | implemented |
| [`welcome-email`](./welcome-email.md)                     | `1`          | Transacional | `api/email-templates/welcome-email/v1/template.html`           | implemented |

## Referências

- [Modelo e versionamento](./template-model.md)
- [Design system](./design-system.md)
