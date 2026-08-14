---
area: notifications
type: email-template
status: current
template_key: password-change-blocked
template_version: 1
email_type: PASSWORD_CHANGE_BLOCKED
source: api/email-templates/password-change-blocked/v1/template.html
---

# Password Change Blocked

## Identidade

| Campo         | Valor                                                          |
| ------------- | -------------------------------------------------------------- |
| Chave         | `password-change-blocked`                                      |
| Versão ativa  | `1`                                                            |
| Tipo          | `PASSWORD_CHANGE_BLOCKED`                                      |
| Categoria     | segurança transacional                                         |
| Trigger       | `auth.password-change.block-started`                           |
| Fila/job      | `notifications.email` / `send-email-message`                   |
| Fonte HTML    | `api/email-templates/password-change-blocked/v1/template.html` |
| Mapping Brevo | `BREVO_TEMPLATE_PASSWORD_CHANGE_BLOCKED_V1_ID`                 |

O valor do mapping pertence ao ambiente e não faz parte deste contrato.

## Finalidade

Informar que novas tentativas de alteração de senha foram bloqueadas e mostrar
até quando a restrição permanece ativa.

## Idempotência

```text
email:password-change:event:<sourceEventId>
```

Somente o início de um bloqueio produz a intenção. Requisições rejeitadas por um
bloqueio já ativo não geram outro e-mail.

## Parâmetros V1

| Parâmetro          | Tipo                  | Origem                            | Sensível                |
| ------------------ | --------------------- | --------------------------------- | ----------------------- |
| `first_name`       | string não vazia      | usuário, com fallback pelo e-mail | não                     |
| `blocked_until`    | `DD/MM/AAAA às HH:mm` | término convertido para Brasília  | não                     |
| `ip_address`       | string não vazia      | contexto sanitizado ou fallback   | dado pessoal            |
| `location`         | string não vazia      | contexto sanitizado ou fallback   | dado pessoal aproximado |
| `browser`          | string não vazia      | contexto sanitizado ou fallback   | não                     |
| `operating_system` | string não vazia      | contexto sanitizado ou fallback   | não                     |
| `device`           | string não vazia      | contexto sanitizado ou fallback   | não                     |
| `support_url`      | URL absoluta          | `SUPPORT_URL`                     | não                     |

## Conteúdo V1

- Assunto: `Alteração de senha temporariamente bloqueada`.
- Preheader: `Alteração de senha bloqueada.` (29 caracteres).
- Título: `Alteração de senha temporariamente bloqueada`.
- Corpo: explica que somente a alteração de senha foi bloqueada e não revela o
  limite de tentativas.
- Painel: término no horário de Brasília, IP, localização aproximada, navegador,
  sistema e
  dispositivo.
- CTA: `Falar com o suporte`, direcionado a `support_url`.

## Segurança

- Não informar quantas tentativas faltavam ou confirmar qualquer senha.
- Não incluir senha, hash, JWT, JTI, cookie ou segredo.
- IP e localização servem somente como contexto de reconhecimento.
- Não registrar valores dos parâmetros.
- O template hospedado usa `security@danfy.app`; o worker não envia `sender` e
  deixa a Brevo aplicar o remetente desta versão.
