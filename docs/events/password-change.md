---
area: events
type: event-group
status: current
related:
  - ./README.md
  - ../auth/change-password/notifications.md
  - ../specs/auth/change-password/specs/design.md
---

# Eventos de alteração de senha

O fluxo de alteração de senha grava quatro contratos na transactional outbox.
Eles só ficam visíveis ao worker depois do commit do hash, da versão da
credencial e dos fatos em `password_change_events`.

| Evento                                         | Finalidade                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------- |
| `auth.password-change.state-refresh-requested` | reconstruir a projeção Redis a partir do PostgreSQL                   |
| `auth.password-change.changed`                 | fato de segurança consumido pela futura notificação de senha alterada |
| `auth.password-change.block-started`           | fato consumido pela futura notificação de bloqueio                    |
| `auth.sessions.revoke-all-requested`           | repetir a limpeza física das refresh sessions                         |

Todos usam `aggregateType=User`, `aggregateId=userId`, versão `1` e
deduplicação baseada no ID do fato de `password_change_events`.

## Payloads

O evento de refresh contém `userId`, `sourceEventId` e o token curto da barreira
Redis. O evento de revogação contém apenas `userId` e `sourceEventId`.

Os eventos de alteração e bloqueio também carregam contexto sanitizado:

- IP, quando resolvido por proxy confiável;
- localização aproximada;
- navegador;
- sistema operacional;
- dispositivo;
- `blockedUntil` no evento de bloqueio.

Eles não carregam senha, hash, JWT, JTI, cookie ou headers completos. Os
rehydrators usam schemas estritos e rejeitam campos inesperados.

## Consumo atual

- O reconciliador Redis e a limpeza de sessões são implementados nesta feature.
- A criação de `email_messages`, os templates e a fila de envio pertencem à spec
  de notificações de alteração de senha.
- Handlers usam `suppressErrors: false`; falhas retornam ao processor da outbox
  e seguem a política persistida de retry.
