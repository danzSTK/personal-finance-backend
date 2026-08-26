---
area: notifications
type: email-template
status: current
template_key: email-verification
template_version: 1
email_type: EMAIL_VERIFICATION
source: api/email-templates/email-verification/v1/template.html
---

# Email Verification

## Identidade

| Campo         | Valor                                                     |
| ------------- | --------------------------------------------------------- |
| Chave         | `email-verification`                                      |
| Versão ativa  | `1`                                                       |
| Tipo          | `EMAIL_VERIFICATION`                                      |
| Categoria     | transacional                                              |
| Trigger       | `user.created` pendente ou reenvio autenticado            |
| Fila/job      | `notifications.email` / `send-email-message`              |
| Fonte HTML    | `api/email-templates/email-verification/v1/template.html` |
| Mapping Brevo | `BREVO_TEMPLATE_EMAIL_VERIFICATION_V1_ID`                 |

O valor do mapping pertence ao ambiente e não faz parte deste contrato.

## Finalidade

Enviar o link de uso único que confirma o endereço de e-mail de uma conta por
credenciais.

## Idempotência

```text
email:verification:challenge:<challengeId>
```

Cada challenge gera no máximo uma intenção. Um reenvio cria outro challenge.

O challenge automático inicial é idempotente por usuário e purpose. Challenges
registram `origin=AUTOMATIC` ou `MANUAL_RESEND`; registros anteriores à migration
e inserts feitos pela imagem anterior durante rollback recebem `LEGACY_UNKNOWN`
para auditoria e compatibilidade.

## Parâmetros V1

| Parâmetro            | Tipo             | Origem                            | Sensível |
| -------------------- | ---------------- | --------------------------------- | -------- |
| `first_name`         | string não vazia | usuário, com fallback pelo e-mail | não      |
| `verification_url`   | URL absoluta     | frontend + token de uso único     | sim      |
| `expires_in_minutes` | inteiro positivo | TTL do challenge                  | não      |
| `support_url`        | URL absoluta     | configuração de suporte           | não      |

## Segurança

- O token completo aparece na URL enviada e não pode ser registrado em logs.
- O challenge guarda `token_hash`, mas a intenção atualmente persiste a URL
  completa em `template_params` para o worker assíncrono.
- A proteção desse valor em repouso será decidida em estudo de criptografia
  separado antes da produção.
- Erros e observabilidade podem registrar chave, versão e `emailMessageId`, mas
  nunca os parâmetros.

## Prazo De Entrega

A intenção define `deliver_before = challenge.expires_at - 5 minutos`. Com token
de 15 minutos, o worker possui até 10 minutos para iniciar a entrega e preserva
uma janela mínima de uso de cinco minutos. Se `deliver_before <= now`, a intenção
vira `CANCELED`, o provider não é chamado e o processor lança o erro terminal do
BullMQ depois de persistir o estado.
