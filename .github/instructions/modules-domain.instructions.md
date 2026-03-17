---
applyTo: "api/src/modules/*/domain/**"
---

# Regras: Camada de Domínio

## Entidades de Domínio
- NUNCA importar decorators TypeORM (`@Column`, `@Entity`, etc.) — domínio é agnóstico de infraestrutura
- NUNCA importar `HttpException`, `BadRequestException` ou qualquer classe do `@nestjs/common` nas entidades
  - Exceção temporária aceita: VOs ainda lançam `BadRequestException` — migrar para `DomainException` própria
- Toda entidade tem `private readonly props: <Nome>Props` e `public readonly id: string`
- Propriedades expostas apenas via `get` (getters) — nunca campos públicos diretos
- Construtor privado ou protegido; criação via `static create()` e reconstituição via `static reconstitute()`
- `authProviders` e listas similares retornam `ReadonlyArray<T>` para garantir imutabilidade externa

## Value Objects
- Estrutura obrigatória:
  - `private constructor(value: T)`
  - `static create(raw): VO` — valida e normaliza (ex: `.trim().toLowerCase()`)
  - `static reconstitute(raw): VO` — reconstrói sem validação (vindo do banco)
  - `get value(): T`
  - `equals(other: VO): boolean`
- VOs são imutáveis: nenhum setter, nenhum método que mute o estado interno
- Validações com constantes de `common/models/constants`, nunca hardcoded

## Factories
- Usar `Factory` quando a criação da entidade envolve decisão de tipo (ex: `AuthProviderFactory` que decide entre `CredentialsAuthProvider` e `OAuthProvider`)
- Factory retorna a entidade de domínio, nunca a ORM entity

## Interfaces de Repositório
- Definidas AQUI no domínio, implementadas na infraestrutura
- Operações atômicas: se um use case precisa de transação, o repositório recebe `IRepositoryOptions` como parâmetro opcional
- Nunca expor métodos TypeORM (`QueryBuilder`, `EntityManager`) nas interfaces
