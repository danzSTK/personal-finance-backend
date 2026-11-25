---
area: transactions
feature: balance-adjustment
type: spec-requirements
status: current
related:
  - ../../../../transactions/README.md
  - ../../../../transactions/flows/balance-adjustment.md
  - ../../../../transactions/decisions/adjustments-are-technical-transactions.md
  - ../../../../transactions/reference/invariants.md
  - ../../../../accounts/concepts/account-balance.md
  - ../../../../integrations/date-and-time.md
---

# Requirements - Balance Adjustment (Cálculo Automático por Saldo Alvo)

## Objetivo

Permitir que o usuário autenticado reajuste o saldo atual de uma account informando o saldo alvo desejado (`targetBalanceCents`), deixando o backend calcular automaticamente a diferença em relação ao saldo atual derivado e registrar a transaction técnica `ADJUSTMENT` correspondente.

O modo manual existente em `POST /transactions` (com `type = ADJUSTMENT`, `amountCents` e `direction` explícitos) permanece inalterado.

## Fonte De Contexto

As regras desta spec consolidam:

- [Adjustments are technical transactions](../../../../transactions/decisions/adjustments-are-technical-transactions.md)
- [Balance adjustment flow](../../../../transactions/flows/balance-adjustment.md)
- [Transactions invariants](../../../../transactions/reference/invariants.md)
- [Account balance](../../../../accounts/concepts/account-balance.md)
- [Date and time contract](../../../../integrations/date-and-time.md)
- [Transactions core spec](../../core/specs/requirements.md)

## Escopo

- Novo endpoint dedicado `POST /transactions/balance-adjustments`.
- Cálculo automático do delta entre `targetBalanceCents` informado e o saldo atual derivado (`currentCents`) da account.
- Determinação automática de `direction` (`INCREASE` ou `DECREASE`) e `amountCents` positivo.
- Criação de transaction com `type = ADJUSTMENT`, `status = EFFECTIVE`, `effectiveAt` preenchido e categoria técnica `ADJUSTMENT` resolvida internamente.
- Suporte a `targetBalanceCents` negativo, zero ou positivo.
- `description` opcional com fallback padrão `"Reajuste de saldo"`.
- `date` (`DateOnly`, `YYYY-MM-DD`) obrigatória no payload.
- Proteção contra concorrência na leitura do saldo e gravação do ajuste via transação SQL com lock na account.
- Retorno direto da transaction criada (`TransactionResponseDto`).
- Atualização de documentação de fluxo, integração e contrato de erros.

## Fora Do Escopo

- Alterar ou remover o fluxo manual de `ADJUSTMENT` em `POST /transactions`.
- Reajuste baseado em saldo projetado (`projectedCents`) ou em data histórica retroativa específica (o cálculo sempre usa o saldo atual derivado `currentCents`).
- Criação de ajuste em status `PENDING`.
- Alteração de `initialBalanceCents` da account.
- Migrations ou alterações de schema de banco.
- Anexos em transactions `ADJUSTMENT` (continuam proibidos pelo domínio).

## Regras De Negócio

### Ownership e Disponibilidade da Account

- O `userId` sempre vem da sessão autenticada; nunca é aceito no body.
- A `accountId` deve existir, pertencer ao usuário autenticado e estar ativa (`isArchived = false`).
- Accounts inexistentes, de outro usuário ou arquivadas devem ser rejeitadas com `TRANSACTION_ACCOUNT_UNAVAILABLE`.

### Cálculo do Saldo Alvo e Delta

- O saldo de referência é o saldo atual derivado da account (`currentCents`), composto por `initialBalanceCents` mais todas as transactions `EFFECTIVE` e não deletadas (`deleted_at IS NULL`), ignorando `PENDING`.
- `targetBalanceCents` aceita qualquer inteiro seguro: negativo, zero ou positivo.
- O delta é calculado com precisão inteira exata (`BigInt(targetBalanceCents) - BigInt(currentBalanceCents)`):
  - se `delta > 0`, a transaction criada tem `direction = INCREASE` e `amountCents = delta`;
  - se `delta < 0`, a transaction criada tem `direction = DECREASE` e `amountCents = |delta|`;
  - se `delta === 0`, nenhuma transaction deve ser criada e o sistema deve retornar erro `BALANCE_ADJUSTMENT_NO_DIFFERENCE` (`409 Conflict`).
- Se `|delta|` exceder `TRANSACTION_AMOUNT_CENTS_MAX` (`Number.MAX_SAFE_INTEGER`), a operação deve falhar com `INVALID_TRANSACTION` (`400 Bad Request`).

### Forma da Transaction Criada

- `type = ADJUSTMENT`
- `status = EFFECTIVE`
- `effectiveAt = now` (instante UTC)
- `destinationAccountId = null`
- `categoryId` = categoria técnica ativa `ADJUSTMENT` do usuário resolvida pelo backend.
- `date` = data `DateOnly` (`YYYY-MM-DD`) enviada na requisição.
- `description`:
  - se enviada com texto não vazio após `trim()`, persiste o texto normalizado (`trim()`);
  - se omitida, `null` ou composta apenas por espaços, utiliza o fallback padrão `"Reajuste de saldo"`;
  - respeita o limite máximo de 500 caracteres (`TRANSACTION_DESCRIPTION_MAX_LENGTH`).

### Concorrência e Atomicidade

- A verificação/lock da account, o cálculo do saldo atual e a persistência da transaction `ADJUSTMENT` devem ocorrer dentro da mesma transação de banco, com lock pessimista (`FOR UPDATE`) na linha da account.

## Requisitos Funcionais

### REQ-001 - Reajuste automático com aumento de saldo

WHEN o usuário autenticado enviar `POST /transactions/balance-adjustments` com `targetBalanceCents > currentCents`
THE SYSTEM SHALL calcular `amountCents = targetBalanceCents - currentCents`, definir `direction = INCREASE`, `status = EFFECTIVE`, resolver a categoria técnica `ADJUSTMENT`, persistir a transaction e retornar `201 Created` com `TransactionResponseDto`.

### REQ-002 - Reajuste automático com redução de saldo (incluindo saldo alvo negativo ou zero)

WHEN o usuário autenticado enviar `POST /transactions/balance-adjustments` com `targetBalanceCents < currentCents` (inclusive com `targetBalanceCents <= 0`)
THE SYSTEM SHALL calcular `amountCents = currentCents - targetBalanceCents`, definir `direction = DECREASE`, `status = EFFECTIVE`, persistir a transaction e retornar `201 Created` com `TransactionResponseDto`.

### REQ-003 - Rejeição quando não há diferença de saldo

IF `targetBalanceCents === currentCents`
THEN THE SYSTEM SHALL NOT criar nenhuma transaction e SHALL responder `409 Conflict` com código `BALANCE_ADJUSTMENT_NO_DIFFERENCE`.

### REQ-004 - Fallback de descrição

IF `description` for omitida, `null` ou vazia/espaços
THEN THE SYSTEM SHALL gravar `description = "Reajuste de saldo"`.

IF `description` contiver texto válido
THEN THE SYSTEM SHALL gravar `description.trim()`.

### REQ-005 - Validação de account, categoria técnica, data e limites

IF a account não existir, pertencer a outro usuário ou estiver arquivada
THEN THE SYSTEM SHALL responder `409 Conflict` com `TRANSACTION_ACCOUNT_UNAVAILABLE`.

IF a categoria técnica `ADJUSTMENT` do usuário não existir ou estiver arquivada
THEN THE SYSTEM SHALL responder `400 Bad Request` com `TRANSACTION_CATEGORY_UNAVAILABLE`.

IF `date` estiver ausente ou fora do formato `YYYY-MM-DD` válido, ou `targetBalanceCents` não for um inteiro seguro
THEN THE SYSTEM SHALL responder `400 Bad Request` com `VALIDATION_ERROR`.

IF `|targetBalanceCents - currentCents|` exceder `TRANSACTION_AMOUNT_CENTS_MAX`
THEN THE SYSTEM SHALL responder `400 Bad Request` com `INVALID_TRANSACTION`.

### REQ-006 - Desconsideração de pendências e transações deletadas

WHEN o sistema calcular o saldo atual para o reajuste
THE SYSTEM SHALL considerar apenas `initialBalanceCents` e transactions `EFFECTIVE` com `deleted_at IS NULL`, ignorando transactions `PENDING` e deletadas.

## Expectativas De API/Frontend

- Rota: `POST /transactions/balance-adjustments`.
- Autenticação via cookie HttpOnly (`JwtAuthGuard`).
- Body JSON: `{ accountId, targetBalanceCents, date, description? }`.
- Response `201 Created`: mesmo shape de `TransactionResponseDto` usado em `POST /transactions`.
- O frontend deve enviar `date` no fuso local do usuário como `YYYY-MM-DD` e tratar `BALANCE_ADJUSTMENT_NO_DIFFERENCE` (`409`) como estado de negócio (saldo já está igual ao informado).

## Critérios De Aceite

- `POST /transactions/balance-adjustments` cria `ADJUSTMENT` `EFFECTIVE` com `INCREASE` ou `DECREASE` e `amountCents` exato para saldos positivos, zero e negativos.
- `delta === 0` retorna `409` com `code = BALANCE_ADJUSTMENT_NO_DIFFERENCE` sem criar registro.
- `description` omitida, `null` ou em branco resulta em `"Reajuste de saldo"`.
- Concorrência protegida via transação com `FOR UPDATE` na account e cálculo de saldo na mesma transação.
- Nenhuma migration ou alteração de schema é introduzida.
- Testes unitários cobrem DTO, use case, validator, filtro de exceção e controller; build, lint, typecheck e testes passam.
- Documentação em `docs/transactions/flows/balance-adjustment.md`, `docs/integrations/transactions/`, `docs/integrations/errors.md` e Swagger atualizados.
