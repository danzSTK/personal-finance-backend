---
area: notifications
type: email-template
status: current
template_key: welcome-email
template_version: 1
email_type: WELCOME
source: api/email-templates/welcome-email/v1/template.html
---

# Welcome Email

## Identidade

| Campo         | Valor                                                |
| ------------- | ---------------------------------------------------- |
| Chave         | `welcome-email`                                      |
| Versão ativa  | `1`                                                  |
| Tipo          | `WELCOME`                                            |
| Categoria     | transacional                                         |
| Trigger       | `user.created`                                       |
| Fila/job      | `notifications.email` / `send-email-message`         |
| Fonte HTML    | `api/email-templates/welcome-email/v1/template.html` |
| Mapping Brevo | `BREVO_TEMPLATE_WELCOME_EMAIL_V1_ID`                 |

O valor do mapping pertence ao ambiente e não faz parte deste contrato.

## Finalidade

Enviar boas-vindas após a criação de uma conta ativa e orientar o primeiro
acesso ao painel Danfy.

## Idempotência

```text
email:welcome:user:<userId>
```

Reprocessar `user.created` recupera a mesma intenção e preserva sua versão.

## Parâmetros V1

| Parâmetro           | Tipo             | Origem                            | Sensível |
| ------------------- | ---------------- | --------------------------------- | -------- |
| `first_name`        | string não vazia | usuário, com fallback pelo e-mail | não      |
| `dashboard_url`     | URL absoluta     | `FRONTEND_URL` + dashboard path   | não      |
| `support_url`       | URL absoluta     | `SUPPORT_URL`                     | não      |
| `support_url_label` | string não vazia | `SUPPORT_URL_LABEL`               | não      |
| `preferences_url`   | URL absoluta     | `FRONTEND_URL` + preferences path | não      |

## Segurança E Operação

- Não adicionar token ou segredo aos parâmetros.
- Não registrar params ou resposta bruta da Brevo.
- Publicar uma nova versão no provider antes de ativar seu mapping.
- Delivery, bounce, abertura e clique permanecem fora deste contrato.
