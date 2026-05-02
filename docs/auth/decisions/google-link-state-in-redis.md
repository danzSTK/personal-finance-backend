---
area: auth
type: decision
status: current
related:
  - ../flows/link-google-provider.md
  - ../reference/redis-keys.md
---

# State Redis No Link Google

## Decisão

Guardar `state -> userId` no Redis durante o vínculo de Google provider.

## Motivos

- Evita callback forjado.
- Amarra o callback OAuth ao usuário autenticado que iniciou o vínculo.
- Permite expiração curta do fluxo.

## Regra

O `state` expira em 10 minutos.

Erros esperados:

- `missing_state`;
- `invalid_state`;
- `google_provider_conflict`.
