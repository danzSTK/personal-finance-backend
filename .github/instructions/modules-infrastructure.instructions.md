---
applyTo: "api/src/modules/*/infrastructure/**"
---

# Regras: Camada de Infraestrutura

## ORM Entities (Persistence)
- Ficam em `infrastructure/persistence/`
- Nome: `<nome>-orm-entity.ts` ou `<nome>-orm.entity.ts`
- Campos sensíveis (`passwordHash`, `refreshTokenHash`) OBRIGATORIAMENTE com `{ select: false }`
- Soft delete: `@DeleteDateColumn()` em entidades que precisam de auditoria
- NUNCA importadas fora da camada de infraestrutura

## Repositórios
- `<nome>.repository.ts` — implementação TypeORM da interface do domínio
- `cached-<nome>.repository.ts` — Decorator GoF: envolve o repositório base adicionando cache Redis
  - Padrão de cache key: `<entidade>:<campo>:<valor>` (ex: `user:email:foo@bar.com`)
  - TTL padrão: 5 minutos para leitura; invalidação imediata após escrita/deleção
  - Cache é transparente para a aplicação — o Use Case injeta `IRepository` e não sabe se é cached ou não
  - Cache é RedisService, não cache in-memory — garante consistência entre múltiplas instâncias da aplicação
  - As keys do cache devem ser cuidadosamente projetadas para evitar colisões e garantir alta seletividade (ex: incluir o tipo de entidade e o campo de consulta)
  - As keys do cache existe uma factory function para criar as keys. Ela está no modulo `common/utils/cache-key-factory.ts` e deve ser usada para garantir consistência na criação das keys do cache.
  - Sempre que for criada uma nova cache key deve ser atribuída ao cache-key-factory para garantir que as keys sejam criadas de forma consistente em toda a aplicação.
- A implementação ativa (cached ou não) é escolhida no `<nome>.module.ts` via token de injeção

## Mappers
- Ficam em `infrastructure/mappers/`
- Método `toDomain(ormEntity): DomainEntity` — usa `.reconstitute()` dos VOs, nunca `.create()`
- Método `toPersistence(domainEntity): OrmEntity` — extrai os valores primitivos dos VOs
- Mappers são classes estáticas ou funções puras, sem estado
