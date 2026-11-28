---
name: nestjs-module
description: Use when creating a new NestJS module or domain feature following this repository's DDD and Clean Architecture conventions.
metadata:
  category: architecture
  triggers:
    - nestjs module
    - criar modulo
    - nova feature
    - ddd
    - clean architecture
---

# Criar Módulo NestJS

## Quando usar

Use quando o usuário pedir para criar um novo módulo, feature ou recurso de domínio neste backend NestJS.

## Estrutura obrigatória

```text
modules/<nome>/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── factories/
│   └── repositories/
├── application/
│   └── use-cases/
│       └── <acao>/
│           ├── <acao>.use-case.ts
│           └── <acao>.dto.ts
├── infrastructure/
│   ├── persistence/
│   └── mappers/
├── presentation/
│   ├── http/
│   └── dto/
└── <nome>.module.ts
```

## Regras de implementação

- Domínio deve ser puro: sem TypeORM, sem ORM entities e sem dependência de infraestrutura.
- Entidades e Value Objects concentram regras de negócio.
- Use Cases orquestram domínio + repositórios e expõem `execute(dto, options?)`.
- **Dono único de criação/mutação (`Single Owner of Entity Mutation`):** regras, locks, validações de referência, factory e persistência ao criar ou mutar uma entidade pertencem exclusivamente ao Use Case dono dessa entidade no seu módulo (ex.: `CreateTransactionUseCase` para `Transaction`). Quando outro módulo ou fluxo composto precisar executar essa criação na mesma transação, é proibido duplicar a cadeia `lock -> validate -> Factory.create -> repository.save` em um adapter ou segundo use case; o Use Case proprietário deve aceitar `options?: IRepositoryOptions` (reutilizando `options.manager` quando presente ou abrindo transação própria quando ausente), e a porta pública cross-module delega diretamente para ele.
- DTOs de Use Case são interfaces TypeScript simples.
- DTOs HTTP ficam em `presentation/dto` e usam `class-validator`/`class-transformer`.
- **Derivação de DTOs e tipos de entrada:** DTOs HTTP (`presentation/dto/`) e interfaces de porta/use case que especializam ou estendem a criação/edição de outra entidade devem derivar do DTO/interface canônico por composição (`OmitType`, `PickType`, `PartialType`, `IntersectionType` de `@nestjs/swagger` e `Omit<>` / `Pick<>` em TypeScript), sobrescrevendo apenas os campos que efetivamente mudam e repassando os demais — nunca copiar manualmente um snapshot de campos.
- Controllers ficam em `presentation/http`, são finos e chamam Use Cases.
- Repositórios concretos ficam em `infrastructure/persistence` e implementam interfaces do domínio.
- Mappers ficam em `infrastructure/mappers` e convertem ORM entity para domínio com `reconstitute()`.
- Cached repositories devem usar o cache key factory do projeto.
- O binding de interface para implementação ativa fica no `<nome>.module.ts`.

## Checklist ao criar feature

- Criar ou atualizar entidade/VO/factory no domínio.
- Criar interface de repositório no domínio quando necessário.
- Criar use case e DTO de aplicação.
- Quando o fluxo criar ou mutar entidade de outro módulo, delegar à porta pública que aciona o Use Case dono (propagando `options.manager`) e derivar DTOs/interfaces de entrada por composição, sem duplicar regras ou campos.
- Criar/atualizar ORM entity, repository, cached repository e mapper.
- Criar DTOs de apresentação e controller.
- Registrar providers no module.
- Criar testes de domínio e use case.
- Criar migration quando houver mudança de schema.
