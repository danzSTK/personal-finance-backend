---
area: notifications
type: email-template
status: current
template_key: welcome-email
provider: brevo
provider_template_id: "2"
email_type: WELCOME
---

# Welcome Email

## Identidade

| Campo                | Valor                 |
| -------------------- | --------------------- |
| Key interna          | `welcome-email`       |
| Provider             | `brevo`               |
| Provider template id | `2`                   |
| Tipo                 | `WELCOME`             |
| Categoria            | transacional          |
| Trigger              | `user.created`        |
| Fila                 | `notifications.email` |
| Job                  | `send-email-message`  |

## Caso De Uso

Enviar e-mail de boas-vindas após a criação de uma conta.

O e-mail orienta a pessoa a acessar a conta Danfy e oferece links de suporte e preferências.

## Idempotência

Chave persistida:

```text
email:welcome:user:<userId>
```

Job id derivado:

```text
email-message-<emailMessageId>
```

O `jobId` não é persistido no banco no v1.

Estados terminais (`SENT`, `FAILED_PERMANENT`, `CANCELED`) não são reenfileirados automaticamente.

## Parâmetros

| Param               | Obrigatório | Origem                            | Descrição                                  |
| ------------------- | ----------- | --------------------------------- | ------------------------------------------ |
| `first_name`        | sim         | usuário criado                    | Nome exibido em "Olá, ..."                 |
| `dashboard_url`     | sim         | `FRONTEND_URL` + dashboard path   | Link do botão "Acessar minha conta Danfy"  |
| `support_url`       | sim         | `SUPPORT_URL`                     | URL real do suporte                        |
| `support_url_label` | sim         | `SUPPORT_URL_LABEL`               | Texto exibido para o link de suporte       |
| `preferences_url`   | sim         | `FRONTEND_URL` + preferences path | Link para gerenciar preferências de e-mail |

## Payload Esperado

```json
{
  "first_name": "Daniel",
  "dashboard_url": "https://app.danfy.com/dashboard",
  "support_url": "https://danfy.com/suporte",
  "support_url_label": "Central de ajuda",
  "preferences_url": "https://app.danfy.com/settings/email-preferences"
}
```

## Segurança

- Não incluir tokens ou segredos nos params.
- Não persistir URLs com tokens sensíveis em `template_params`.
- Não expor resposta bruta da Brevo em logs.

## Observações Futuras

Webhooks de delivery/bounce/open/click devem referenciar `provider_message_id` e atualizar estrutura própria em spec futura.
