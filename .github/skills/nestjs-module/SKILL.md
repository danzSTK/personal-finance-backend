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
Quando o usuário pedir para criar um novo módulo, feature ou recurso de domínio.

## Estrutura obrigatória
modules/<nome>/
├── domain/
│   ├── entities/          # Entidades de domínio puras (sem ORM)
│   ├── value-objects/     # VOs imutáveis com static create() e reconstitute()
│   ├── factories/         # Factory Method para criação complexa
│   └── repositories/      # Interfaces IRepository (contratos do domínio)
├── application/
│   └── use-cases/
│       └── <acao>/        # Um diretório por Use Case
│           ├── <acao>.use-case.ts
│           └── <acao>.dto.ts
├── infrastructure/
│   ├── persistence/       # ORM entities, implementação repositório, CachedRepository
│   └── mappers/           # Mapper domínio ↔ ORM
├── presentation/
│   ├── http/              # Controllers
│   └── dto/               # DTOs de request/response HTTP
└── <nome>.module.ts


