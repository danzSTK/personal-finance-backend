---
area: accounts
feature: balance-summary
type: spec-design
status: current
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../accounts/concepts/account-balance.md
  - ../../../../transactions/reference/schema.md
---

# Design - Account Balance Summary

## Arquitetura

Esta feature deve ficar no `AccountsModule`, porque o consumidor HTTP está listando accounts e espera receber uma visão enriquecida da account.

O cálculo depende de `transactions`, mas não deve mover a responsabilidade de listar accounts para o `TransactionsModule`.

## Estado Atual Do Código

Hoje o fluxo de listagem é:

```text
AccountsController.list
  -> ListAccountsUseCase.execute
    -> IAccountRepository.listByUserId
      -> AccountRepository/CachedAccountRepository
```

O response atual usa:

```text
AccountResponseDto.fromDomain(account)
```

e retorna apenas dados cadastrais da account.

## Mudança Proposta

Adicionar um componente de leitura/agregação para saldo:

```text
api/src/modules/accounts/
├── application/
│   └── services/
│       └── account-balance-calculator.service.ts
├── domain/
│   └── repositories/
│       └── account-balance.repository.interface.ts
└── infrastructure/
    └── persistence/
        └── account-balance.repository.ts
```

O `ListAccountsUseCase` passa a:

1. buscar accounts pelo repository atual;
2. buscar saldos em lote para as account IDs retornadas;
3. montar um output de aplicação com `{ account, balance }`;
4. deixar o controller serializar via DTO de response.

## Evitar N+1

Não calcular saldo account por account.

O repository de saldo deve receber uma lista de account IDs e retornar um mapa:

```ts
Map<string, AccountBalanceSummary>
```

Isso permite uma query agregada para todas as accounts listadas.

## Contrato Interno Sugerido

```ts
export interface AccountBalanceSummary {
  accountId: string;
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: Date;
}
```

O response HTTP mantém o padrão canônico de dinheiro em centavos:

```json
{
  "currentCents": 125000,
  "projectedCents": 98000,
  "projectedUntil": "2026-06-30"
}
```

## Unidade Monetária

`transactions.amount_cents` já usa centavos.

Esta feature deve migrar `accounts.initial_balance` para `accounts.initial_balance_cents`.

O banco usa `bigint`; o domínio e DTOs usam `number` seguro em centavos.

Migration:

```text
initial_balance_cents = round(initial_balance * 100)::bigint
```

Depois da migration, cálculos de saldo não misturam decimal com centavos.

## Regras De Agregação

### Current

`current` considera:

```text
initial_balance_cents
+ EFFECTIVE INCOME na account
- EFFECTIVE EXPENSE na account
- EFFECTIVE TRANSFER quando account é origem
+ EFFECTIVE TRANSFER quando account é destino
+ EFFECTIVE ADJUSTMENT INCREASE
- EFFECTIVE ADJUSTMENT DECREASE
```

Sempre filtrar:

```text
transactions.user_id = userId
transactions.deleted_at IS NULL
transactions.status = 'EFFECTIVE'
```

### Projected

`projected` considera:

```text
initial_balance_cents
+ deltas de EFFECTIVE ou PENDING
```

com:

```text
transactions.date <= projectedUntil
transactions.deleted_at IS NULL
```

`projected` deve ser calculado somente quando `projectedUntil` for informado.

## Query Strategy

O `AccountBalanceRepository` pode usar SQL agregado com `CASE`.

Pontos importantes:

- incluir transactions em que a account é `account_id`;
- incluir transfers em que a account é `destination_account_id`;
- aplicar sinais diferentes por tipo;
- agrupar por account;
- retornar zero quando não houver transaction.

Uma abordagem segura é agregar em duas leituras ou em uma query com `UNION ALL`:

```text
origin movements:
  account_id como account afetada

destination transfer movements:
  destination_account_id como account afetada
```

Depois somar por account.

## Presentation DTO

Adicionar ao `AccountResponseDto`:

```ts
balance: {
  currentCents: number;
  projectedCents?: number;
  projectedUntil?: string;
}
```

Adicionar ao `ListAccountsQueryDto`:

```ts
projectedUntil?: string; // YYYY-MM-DD
```

Reutilizar a validação de date-only já usada em transactions, ou extrair helper comum se fizer sentido.

## API

Endpoint mantido:

```http
GET /accounts
GET /accounts?projectedUntil=2026-06-30
GET /accounts?includeArchived=true&projectedUntil=2026-06-30
```

Não criar endpoint separado nesta spec.

Motivo: o frontend já precisa da lista de accounts para exibir seleção/visão geral; o saldo é parte natural da leitura da account.

## Dependências Entre Módulos

Não importar `TransactionsModule` dentro de `AccountsModule`, porque `TransactionsModule` já importa `AccountsModule`.

Para evitar ciclo:

- manter a leitura agregada dentro da infraestrutura de accounts;
- usar `TransactionOrmEntity` apenas como dependência de infraestrutura, como o `AccountRepository` já faz em `hasFutureScheduledTransactions`;
- não injetar `ITransactionRepository` no `AccountsModule`.

## Cache

Não cachear o saldo nesta primeira versão.

Motivo:

- saldo muda a cada create/update/confirm/delete de transaction;
- invalidação envolveria accounts de origem e destino;
- a spec inicial precisa privilegiar consistência.

O cache atual de accounts cadastrais pode continuar existindo, mas o balance summary deve ser calculado no momento da leitura.

## Erros

Reutilizar o contrato global:

- `VALIDATION_ERROR` para `projectedUntil` malformado;
- `UNAUTHORIZED` para sessão ausente/inválida.

Não criar erro de domínio novo para projeção nesta spec.

## Testes

Criar testes de application/service/repository cobrindo:

- account sem transactions;
- income effective;
- expense effective;
- transfer como origem;
- transfer como destino;
- adjustment increase/decrease;
- pending ignorada no current;
- pending considerada no projected até data limite;
- pending depois de `projectedUntil` ignorada;
- transaction deletada ignorada;
- includeArchived preservando comportamento atual.

## Documentação

Atualizar:

- `docs/accounts/concepts/account-balance.md`;
- `docs/accounts/decisions/account-balance-is-derived.md`;
- `docs/integrations/accounts/list-accounts.md`;
- Swagger de `GET /accounts`.

## Migration

Criar migration para migrar `accounts.initial_balance` para `accounts.initial_balance_cents`.

Estratégia:

1. adicionar coluna `initial_balance_cents bigint`;
2. preencher com `ROUND(initial_balance * 100)::bigint`;
3. aplicar `NOT NULL DEFAULT 0`;
4. adicionar check `initial_balance_cents >= 0`;
5. remover coluna antiga `initial_balance`.

O `down` deve recriar `initial_balance numeric(10,2)`, popular com `initial_balance_cents::numeric / 100`, restaurar `NOT NULL DEFAULT 0.00` e remover `initial_balance_cents`.
