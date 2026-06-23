---
area: assets
type: decision
status: accepted
related:
  - ../concepts/asset.md
  - ../../storage/README.md
---

# Persistir Asset Separado Do Objeto

## Decisão

Persistir uma linha em `assets` para cada objeto controlado pela plataforma. Os bytes permanecem no Object Storage.

## Motivos

- ownership consultável sem interpretar key;
- ciclo de vida explícito;
- troca segura de referências;
- auditoria de falhas e exclusões;
- reconciliação entre PostgreSQL e R2;
- URLs derivadas sem acoplar o banco ao domínio público atual.

## Consequência

PostgreSQL e R2 não são transacionais entre si. Status e reconciliação passam a fazer parte obrigatória do desenho.
