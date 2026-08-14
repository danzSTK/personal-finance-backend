---
area: notifications
type: email-template
status: current
template_key: password-changed
template_version: 1
email_type: PASSWORD_CHANGED
source: api/email-templates/password-changed/v1/template.html
---

# Password Changed

## Identidade

| Campo         | Valor                                                   |
| ------------- | ------------------------------------------------------- |
| Chave         | `password-changed`                                      |
| Versão ativa  | `1`                                                     |
| Tipo          | `PASSWORD_CHANGED`                                      |
| Categoria     | segurança transacional                                  |
| Trigger       | `auth.password-change.changed`                          |
| Fila/job      | `notifications.email` / `send-email-message`            |
| Fonte HTML    | `api/email-templates/password-changed/v1/template.html` |
| Mapping Brevo | `BREVO_TEMPLATE_PASSWORD_CHANGED_V1_ID`                 |

O valor do mapping pertence ao ambiente e não faz parte deste contrato.

## Finalidade

Informar que a senha foi alterada e fornecer contexto suficiente para o usuário
reconhecer a ação e procurar suporte caso não tenha sido o responsável.

## Idempotência

```text
email:password-change:event:<sourceEventId>
```

Reprocessar o mesmo fato recupera a intenção existente e preserva sua versão.

## Parâmetros V1

| Parâmetro          | Tipo                  | Origem                            | Sensível                |
| ------------------ | --------------------- | --------------------------------- | ----------------------- |
| `first_name`       | string não vazia      | usuário, com fallback pelo e-mail | não                     |
| `changed_at`       | `DD/MM/AAAA às HH:mm` | instante convertido para Brasília | não                     |
| `ip_address`       | string não vazia      | contexto sanitizado ou fallback   | dado pessoal            |
| `location`         | string não vazia      | contexto sanitizado ou fallback   | dado pessoal aproximado |
| `browser`          | string não vazia      | contexto sanitizado ou fallback   | não                     |
| `operating_system` | string não vazia      | contexto sanitizado ou fallback   | não                     |
| `device`           | string não vazia      | contexto sanitizado ou fallback   | não                     |
| `support_url`      | URL absoluta          | `SUPPORT_URL`                     | não                     |

## Conteúdo V1

- Assunto: `Sua senha foi alterada`.
- Preheader: `Sua senha foi alterada na Danfy.` (32 caracteres).
- Título: `Sua senha foi alterada`.
- Corpo: confirma a alteração e informa a revogação das sessões anteriores.
- Painel: horário de Brasília, IP, localização aproximada, navegador, sistema e
  dispositivo.
- CTA: `Não reconheço esta alteração`, direcionado a `support_url`.

## Segurança

- Não incluir senha, hash, JWT, JTI, cookie ou segredo.
- IP e localização servem somente como contexto de reconhecimento.
- Não registrar valores dos parâmetros.
- Falha de envio não desfaz a alteração já confirmada.
- O template hospedado usa `security@danfy.app`; o worker não envia `sender` e
  deixa a Brevo aplicar o remetente desta versão.
