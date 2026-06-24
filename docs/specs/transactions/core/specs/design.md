---
area: transactions
feature: core
type: spec-design
status: current
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../transactions/reference/invariants.md
  - ../../../../database/schema.md
---

# Design - Transactions Core

## Arquitetura

Criar um módulo próprio `TransactionsModule`.

Transactions tem ciclo de vida próprio e não deve morar dentro de `accounts` ou `categories`. O módulo depende das regras desses domínios, mas a transaction é o registro financeiro central que conecta account, category e usuário.

Estrutura esperada:

```text
api/src/modules/transactions/
├── transactions.module.ts
├── domain/
│   ├── entities/
│   ├── factories/
│   ├── repositories/
│   └── errors/
├── application/
│   └── use-cases/
├── infrastructure/
│   ├── mappers/
│   └── persistence/
└── presentation/
    ├── dto/
    └── http/
```

## Dependências Entre Módulos

`TransactionsModule` deve depender de contratos de:

- `AccountsModule`, para validar ownership, estado arquivado e existence de account;
- `CategoriesModule`, para validar ownership, estado arquivado, tipo e categoria técnica;
- `Users/Auth`, apenas indiretamente via `CurrentUser` no controller.

O controller nunca recebe `userId` do body. Ele extrai o usuário autenticado e passa `userId` para o use case.

## Modelo De Persistência

A tabela `transactions` deve seguir o schema atual documentado em [Schema do Banco](../../../../database/schema.md).

Campos principais:

- `id`;
- `user_id`;
- `account_id`;
- `destination_account_id`;
- `category_id`;
- `type`;
- `status`;
- `amount_cents`;
- `date`;
- `effective_at`;
- `description`;
- `direction`;
- `deleted_at`;
- `created_at`;
- `updated_at`.

### Transfer Em Uma Linha

Transferência será persistida em uma linha:

- `account_id`: origem;
- `destination_account_id`: destino;
- `type = TRANSFER`;
- `amount_cents`: valor transferido.

Essa decisão reduz complexidade inicial e mantém a atomicidade no próprio registro.

### Delete Interno

O comportamento de produto é delete.

A implementação pode usar `deleted_at` como soft delete técnico.

Repositories e queries padrão devem filtrar `deleted_at IS NULL`.

## Domínio

### Entity

Criar `Transaction` como entidade de domínio pura.

Ela deve proteger:

- amount positivo;
- coerência entre status e effectiveAt;
- coerência entre type e destinationAccountId;
- coerência entre type e direction;
- description obrigatória para adjustment;
- bloqueio de delete para transfer;
- transição de pending para effective.

### Factory

Criar `TransactionFactory` para centralizar criação a partir de input validado pelo use case.

A factory deve resolver defaults do domínio, como:

- status inicial quando necessário;
- `effectiveAt` para transactions já efetivadas;
- ausência de `effectiveAt` em pendências.

### Value Objects

A primeira versão pode usar constantes e validações na entidade se a regra ficar pequena.

Criar Value Object quando a regra ganhar complexidade real, especialmente para:

- dinheiro em centavos;
- datas financeiras;
- description/motivo de adjustment.

## Application Layer

Use cases iniciais:

```text
create-transaction
list-transactions
get-transaction
update-transaction
confirm-transaction
delete-transaction
```

Cada use case deve viver em seu diretório com:

```text
<action>.use-case.ts
<action>.dto.ts
```

DTOs de use case são interfaces TypeScript simples.

Use cases orquestram:

- busca de account;
- busca de category;
- resolução interna de category técnica para `TRANSFER` e `ADJUSTMENT`;
- validação de ownership;
- validação de status arquivado;
- validação de compatibilidade category/type;
- chamada da entidade/factory;
- persistência via repository interface.

## Repository

Criar interface no domínio:

```text
domain/repositories/transaction.repository.interface.ts
```

Criar implementação TypeORM em:

```text
infrastructure/persistence/transaction.repository.ts
```

Criar mapper em:

```text
infrastructure/mappers/transaction.mapper.ts
```

Não iniciar com cache de transactions.

Motivo: transactions mudam saldo, listagem e relatórios; cache deve entrar apenas quando houver padrão claro de invalidação.

## ORM Entity

O ORM de transaction deve morar no módulo:

```text
api/src/modules/transactions/infrastructure/persistence/transaction-orm.entity.ts
```

A entidade legada em `api/src/entities/transaction.entity.ts` foi migrada para o padrão modular durante a implementação desta spec.

`api/src/config/entities.ts` deve apontar para o ORM entity modular.

## Validação

### Presentation DTO

Presentation DTO deve validar forma de entrada:

- campos obrigatórios;
- formato UUID;
- enums aceitos;
- date válida;
- amount em formato seguro;
- description não vazia quando enviada;
- filtros de listagem.

### Domain/Application

Domínio e application devem validar regra real:

- owner de account/category;
- category gerenciável informada pelo frontend para `INCOME` e `EXPENSE`;
- category técnica resolvida pelo backend para `TRANSFER` e `ADJUSTMENT`;
- category compatível com transaction type;
- category arquivada;
- account arquivada;
- transfer com origem/destino diferentes;
- adjustment com direction e motivo;
- status/date/effectiveAt.

O banco protege invariantes estruturais, mas não substitui validação de domínio.

## Dinheiro

Persistência usa `amount_cents`.

Contrato interno dos use cases deve trabalhar com centavos como inteiro.

O contrato HTTP V0 também usará `amountCents`.

Motivo:

- mantém API, domínio e banco no mesmo formato;
- evita parsing decimal ambíguo na primeira versão;
- força o frontend a ser explícito sobre centavos.

Uma API futura pode aceitar string decimal em uma camada de conveniência, mas o core nasce em centavos.

## Erros

Seguir o padrão `platform-errors`:

- erros de domínio para invariantes da entidade;
- erros de aplicação para recurso não encontrado, ownership inválido, conflito de operação e combinações inválidas;
- `AppExceptionFilter` traduz para contrato HTTP uniforme.

Não retornar erro bruto de banco ao frontend.

## Segurança

- Todos os reads/writes filtram por `userId`.
- Repositories podem receber `userId` nos métodos de busca de operação.
- Controller protegido com `JwtAuthGuard`.
- Nenhuma rota aceita `userId` no body.

## Testes

### Domain

Tests puros para:

- amount positivo;
- pending/effectiveAt;
- transfer destination;
- adjustment direction/description;
- delete proibido para transfer;
- confirm pending.

### Application

Tests com mocks para:

- criar income/expense;
- criar transfer;
- criar adjustment;
- rejeitar account/category de outro usuário;
- rejeitar category incompatível;
- rejeitar archived account/category;
- confirmar pending;
- deletar transaction comum;
- bloquear delete de transfer.

### Infrastructure

Tests de repository podem entrar depois do ORM modular, usando o padrão existente do projeto.

## Documentação E Swagger

Depois da implementação dos endpoints:

- criar `docs/integrations/transactions/**`;
- atualizar Swagger nos DTOs/controllers;
- atualizar `docs/transactions/flows/**` com comportamento real;
- revisar `docs/database/schema.md` caso a implementação altere o schema.

## Aprovação

Esta spec está em `current`.

Não iniciar implementação do módulo antes de aprovar:

- [requirements.md](./requirements.md)
- [design.md](./design.md)
- [tasks.md](./tasks.md)
