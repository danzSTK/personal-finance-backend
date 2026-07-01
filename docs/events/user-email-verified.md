---
area: events
type: event
status: current
eventName: user.email.verified
eventVersion: 1
aggregateType: User
related:
  - ./README.md
  - ./events-map.canvas
---

# UserEmailVerifiedEvent

`user.email.verified` representa o fato de que um usuário confirmou o e-mail principal e foi ativado.

## Contrato

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `userId` | `string` | Identificador do usuário |
| `email` | `string` | E-mail confirmado |

Metadados:

| Campo | Valor |
| --- | --- |
| `eventName` | `user.email.verified` |
| `eventVersion` | `1` |
| `aggregateType` | `User` |
| `aggregateId` | `userId` |
| `deduplicationKey` | `user.email.verified:<userId>` |

## Consumidores

| Status | Módulo | Efeito |
| --- | --- | --- |
| current | `notifications/email` | Enfileira welcome email idempotente |
