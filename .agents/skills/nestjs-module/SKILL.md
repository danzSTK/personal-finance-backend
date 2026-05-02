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
- DTOs de Use Case são interfaces TypeScript simples.
- DTOs HTTP ficam em `presentation/dto` e usam `class-validator`/`class-transformer`.
- Controllers ficam em `presentation/http`, são finos e chamam Use Cases.
- Repositórios concretos ficam em `infrastructure/persistence` e implementam interfaces do domínio.
- Mappers ficam em `infrastructure/mappers` e convertem ORM entity para domínio com `reconstitute()`.
- Cached repositories devem usar o cache key factory do projeto.
- O binding de interface para implementação ativa fica no `<nome>.module.ts`.

## Checklist ao criar feature

- Criar ou atualizar entidade/VO/factory no domínio.
- Criar interface de repositório no domínio quando necessário.
- Criar use case e DTO de aplicação.
- Criar/atualizar ORM entity, repository, cached repository e mapper.
- Criar DTOs de apresentação e controller.
- Registrar providers no module.
- Criar testes de domínio e use case.
- Criar migration quando houver mudança de schema.
