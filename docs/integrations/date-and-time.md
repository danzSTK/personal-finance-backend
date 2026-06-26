---
area: integrations
type: reference
status: current
---

# Date And Time Contract

A API separa datas civis de instantes.

## DateOnly

Use `YYYY-MM-DD` para datas civis.

Exemplos:

- `transactions.date`
- `dateFrom`
- `dateTo`
- `projectedUntil`

Esses campos não têm hora e não têm timezone.

O frontend deve enviar e tratar esses valores como string.

Exemplo:

```json
{
  "date": "2026-06-28"
}
```

O frontend não deve converter esse valor para `Date`/datetime antes de enviar.

`2026-06-28` deve continuar sendo `2026-06-28` em qualquer timezone.

## Instant

Use ISO 8601 UTC para momentos exatos no tempo.

Exemplos:

- `createdAt`
- `updatedAt`
- `effectiveAt`
- `deletedAt`
- `archivedAt`

Exemplo:

```json
{
  "createdAt": "2026-06-25T21:01:53.009Z"
}
```

O frontend pode converter instantes para o timezone local do usuário ao exibir hora.

## Resumo

| Tipo | Formato | Timezone | Exemplo |
| --- | --- | --- | --- |
| `DateOnly` | `YYYY-MM-DD` | não possui | `2026-06-28` |
| `Instant` | ISO 8601 UTC | UTC | `2026-06-25T21:01:53.009Z` |
