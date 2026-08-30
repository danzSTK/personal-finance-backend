---
area: accounts
type: decision
status: accepted
issue: 91
related:
  - ../../specs/accounts/account-templates/specs/design.md
  - ../../database/migration-rollout.md
  - ../../architecture/compatibility.md
  - ../../database/schema.md
---

# Rollout De Account Templates Preserva V0.3

## Decisão

Evoluir account templates em `expand -> migrate -> contract` sem remover na primeira release as colunas e propriedades usadas pela v0.3.

### Expand

- criar `account_templates`;
- adicionar `accounts.template_id` nullable;
- manter `accounts.color` e `accounts.icon`;
- preservar create, update e read executados pela v0.3.

### Migrate

- ativar a imagem nova com dual-read e dual-write;
- continuar aceitando `color`/`icon` no contrato HTTP legado;
- criar templates customizados para payloads/linhas legadas;
- executar seed institucional e reconciliação como comandos explícitos;
- observar linhas nulas, divergências e uso do contrato legado.

### Contract

Somente em migration posterior, planejada para a v0.5 e depois que a v0.3 deixar de ser rollback possível:

- tornar `accounts.template_id` obrigatório;
- remover `accounts.color` e `accounts.icon`;
- remover campos HTTP/cache legados e os shims de leitura/escrita.

## Matriz N/N+1

| Combinação                   | Compatível?                             |
| ---------------------------- | --------------------------------------- |
| v0.3 antes da expand         | sim                                     |
| v0.3 depois da expand        | sim                                     |
| imagem nova antes da expand  | não; a migration deve preceder ativação |
| imagem nova depois da expand | sim                                     |

## Motivos

O deploy executa migrations antes da nova imagem e rollback da aplicação não reverte banco. Remover campos ou exigir `template_id` na expansão tornaria a v0.3 incapaz de escrever.

## Consequências

- A implementação deve registrar `DB-COMPAT-002` em `docs/architecture/compatibility.md`.
- `docs/database/schema.md` documentará o estado expand, inclusive os campos temporários.
- A v0.3 pode criar linhas com `template_id=NULL` depois de rollback; a imagem nova deve tolerar e reconciliar esse estado.
- A limpeza exige gate objetivo, evidência e nova migration; não se altera a migration expand aplicada.
