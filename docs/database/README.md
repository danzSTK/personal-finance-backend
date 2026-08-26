---
area: database
type: index
status: current
---

# Database

Este diretório documenta o schema relacional do backend.

A arquitetura de evolução do banco segue obrigatoriamente o modelo
`expand -> migrate -> contract`. O schema implantado deve continuar compatível
com a imagem anterior durante a janela de rollback; migrations não pressupõem
troca atômica de banco e aplicação.

## Mapa

- [Schema atual](./schema.md)
- [Rollout de migrations](./migration-rollout.md)
- [Registro de compatibilidade](../architecture/compatibility.md)
- [Datas e instantes](../platform/dates-and-times.md)
