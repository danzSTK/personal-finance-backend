---
area: accounts
type: operations
status: current
related:
  - ../../database/migration-rollout.md
  - ../../architecture/compatibility.md
---

# Operações Do Catálogo De Account Templates

Execute a partir de `api/`. Nenhum comando abaixo roda no startup normal.

```bash
npm run account-templates:curate
npm run account-templates:seed
npm run account-templates:reconcile -- 100
```

`curate` consulta BrasilAPI v1, confere os dez registros versionados, baixa apenas SVGs do prefixo HTTPS allowlisted, valida conteúdo/checksum e publica no bucket público configurado sob `banking-institutions-icons/`. Ele exige credenciais de Object Storage e rede. Mudança de checksum interrompe o processo; não sobrescreve objeto sem revisão.

`seed` não usa rede nem Object Storage. Ele faz upsert transacional dos dez templates a partir do catálogo commitado e preserva desativação operacional existente.

`reconcile` não usa rede. Ele processa `accounts.template_id IS NULL` em lotes curtos, com lock e `SKIP LOCKED`, cria um custom privado e mantém `color`/`icon`. É repetível e deve ser executado novamente enquanto writers v0.3 puderem existir.

Ordem: migration expand, seed, ativação da imagem nova, reconciliação e observação dos gates de `DB-COMPAT-002`. Rollback troca a imagem e não reverte a migration.
