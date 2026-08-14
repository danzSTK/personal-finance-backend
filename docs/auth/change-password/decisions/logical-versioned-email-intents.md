---
area: auth
type: decision
status: current
related:
  - ../notifications.md
  - ./separated-outbox-events.md
  - ../../../notifications/email-templates/template-model.md
---

# Intenções lógicas e idempotentes de e-mail

## Decisão

Transformar cada fato `auth.password-change.changed` e
`auth.password-change.block-started` em uma intenção persistida de e-mail. A
intenção usa chave e versão lógicas; somente o adapter do provider conhece o ID
externo do template.

## Motivos

- O commit da senha não pode depender da disponibilidade da Brevo.
- A outbox possui entrega pelo menos uma vez e exige consumo idempotente.
- Chave e versão preservam o contrato usado por uma intenção durante retries.
- Um provider pode ser substituído sem alterar eventos, handlers ou domínio.

## Consequências

- `sourceEventId` forma a chave única da intenção.
- A intenção é persistida antes do enqueue do `emailMessageId`.
- Corridas são resolvidas pela constraint única do PostgreSQL.
- Mensagens terminais não são reenfileiradas; falhas elegíveis podem ser.
- TypeScript, Zod, HTML, mapping e documentação evoluem como um contrato único.
- O conteúdo de uma versão publicada é imutável.
