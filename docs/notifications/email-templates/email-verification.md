---
area: notifications
type: email-template
status: current
template_key: email-verification
provider: brevo
provider_template_id: "3"
email_type: EMAIL_VERIFICATION
---

# Email Verification

## Identidade

| Campo | Valor |
| --- | --- |
| Key interna | `email-verification` |
| Provider | `brevo` |
| Provider template id | `3` |
| Tipo | `EMAIL_VERIFICATION` |
| Categoria | transacional |
| Trigger | `user.created` para credentials pendente e resend autenticado |
| Fila | `notifications.email` |
| Job | `send-email-message` |

## Caso De Uso

Enviar link de confirmação de e-mail para usuários criados por credenciais.

## Idempotência

Chave persistida:

```text
email:verification:challenge:<challengeId>
```

Cada challenge pode gerar no máximo uma intenção de e-mail. Reenvios criam novos challenges.

## Parâmetros

| Param | Obrigatório | Origem |
| --- | --- | --- |
| `first_name` | sim | usuário, com fallback pelo e-mail |
| `verification_url` | sim | `FRONTEND_URL` + `/verification-email?token=<token>` |
| `expires_in_minutes` | sim | config de verification |
| `support_url` | sim | config de suporte |

## Segurança

- O token completo aparece apenas no link enviado ao usuário.
- O banco armazena somente `token_hash`.
- Não registrar token em logs ou metadata.
