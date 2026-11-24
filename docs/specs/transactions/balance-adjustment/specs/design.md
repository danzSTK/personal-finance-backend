---
area: transactions
feature: balance-adjustment
type: spec-design
status: current
related:
  - ./requirements.md
  - ./tasks.md
  - ./decisions.md
  - ../../../../architecture/module-boundaries.md
  - ../../../../database/schema.md
---

# Design - Balance Adjustment (Cálculo Automático por Saldo Alvo)

## Arquitetura e Camadas Afetadas

A feature pertence ao módulo `transactions`, mantendo a direção unidirecional de dependências (`transactions -> accounts`, `transactions -> categories`).

### 1. Common / Constants & Exception Filter
- [`api/src/common/models/constants/transaction.constants.ts`](../../../../../api/src/common/models/constants/transaction.constants.ts):
  - `TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION = 'Reajuste de saldo'`
  - `TRANSACTION_TARGET_BALANCE_CENTS_MIN = Number.MIN_SAFE_INTEGER`
  - `TRANSACTION_TARGET_BALANCE_CENTS_MAX = Number.MAX_SAFE_INTEGER`
- [`api/src/common/filters/app-exception.filter.ts`](../../../../../api/src/common/filters/app-exception.filter.ts):
  - Mapear `BALANCE_ADJUSTMENT_NO_DIFFERENCE` para `HttpStatus.CONFLICT` (`409`).

### 2. Módulo `accounts` (portas públicas de aplicação e suporte transacional)
- Portas públicas de aplicação (`api/src/modules/accounts/application/ports/`):
  - [`AccountBalanceQueryPort`](../../../../../api/src/modules/accounts/application/ports/account-balance-query.port.ts): expõe `getCurrentBalanceCents(input, options?)` para leitura de saldo atual por módulos externos sem expor `IAccountBalanceRepository` diretamente.
  - [`AccountBalanceLockPort`](../../../../../api/src/modules/accounts/application/ports/account-balance-lock.port.ts): expõe `lockAccountsForBalanceMutation(input, options)` para serializar mutações que afetam saldo de contas.
- Adaptadores em `api/src/modules/accounts/infrastructure/adapters/`:
  - [`AccountBalanceQueryAdapter`](../../../../../api/src/modules/accounts/infrastructure/adapters/account-balance-query.adapter.ts): delega para `IAccountBalanceRepository.getSummaries` propagando `options`.
  - [`AccountBalanceLockAdapter`](../../../../../api/src/modules/accounts/infrastructure/adapters/account-balance-lock.adapter.ts): delega para `IAccountRepository.findByIdsAndUserIdForUpdate`.
- Repositórios internos em `accounts`:
  - [`IAccountRepository`](../../../../../api/src/modules/accounts/domain/repositories/account.repository.interface.ts): `findByIdsAndUserIdForUpdate(accountIds: readonly string[], userId: string, options: Required<IRepositoryOptions>): Promise<Account[]>`.
  - Implementação em [`AccountRepository`](../../../../../api/src/modules/accounts/infrastructure/persistence/account.repository.ts) deduplicando e ordenando `accountIds` em ordem ascendente (`ORDER BY account.id ASC`) com `setLock('pessimistic_write')` no `options.manager` (evitando deadlocks em operações multi-conta como `TRANSFER` ou troca de conta).
  - Delegação direta em [`CachedAccountRepository`](../../../../../api/src/modules/accounts/infrastructure/persistence/cached-account.repository.ts) sem usar cache.
  - [`IAccountBalanceRepository`](../../../../../api/src/modules/accounts/domain/repositories/account-balance.repository.interface.ts): parâmetro opcional `options?: IRepositoryOptions` em `getSummaries(input, options?)`, executando via `options?.manager ?? this.dataSource` em [`AccountBalanceRepository`](../../../../../api/src/modules/accounts/infrastructure/persistence/account-balance.repository.ts).
- [`AccountsCoreModule`](../../../../../api/src/modules/accounts/accounts-core.module.ts):
  - Provê e exporta `AccountBalanceQueryPort` e `AccountBalanceLockPort`; mantém `IAccountBalanceRepository` privado ao módulo `accounts`.

### 3. Módulo `transactions`

#### Application Errors
- Novo erro [`BalanceAdjustmentNoDifferenceError`](../../../../../api/src/modules/transactions/application/errors/balance-adjustment-no-difference.error.ts):
  - Estende `ApplicationError`.
  - `readonly code = 'BALANCE_ADJUSTMENT_NO_DIFFERENCE'`.
  - Mensagem padrão: `'Account balance already matches the target balance.'`.

#### Reference Validation (`TransactionReferenceValidator`)
- [`TransactionReferenceValidator`](../../../../../api/src/modules/transactions/application/services/transaction-reference-validator.service.ts):
  - `validate(input, options?)` propaga `options` (`{ manager }`) para `accountRepository.findByIdAndUserId` (origem e destino) e `categoryRepository` (`findActiveSystemByType` / `findByIdAndUserId`), garantindo leituras transacionais consistentes (e bypass de cache em `CachedAccountRepository`).

#### Serialização de Concorrência em Mutações de Saldo
Para impedir que reajustes automáticos leiam saldo obsoleto diante de mutações concorrentes, todas as mutações de `transactions` que alteram saldo serializam nas linhas das contas envolvidas via `AccountBalanceLockPort.lockAccountsForBalanceMutation` dentro da mesma transação SQL, obedecendo à hierarquia acíclica livre de deadlocks (`transactions` 1 linha → `accounts` ordenadas por `id ASC`):
- [`CreateBalanceAdjustmentUseCase`](../../../../../api/src/modules/transactions/application/use-cases/create-balance-adjustment/create-balance-adjustment.use-case.ts): trava `[accountId]`, valida referências, lê saldo via `AccountBalanceQueryPort`, calcula delta e salva.
- [`CreateTransactionUseCase`](../../../../../api/src/modules/transactions/application/use-cases/create-transaction/create-transaction.use-case.ts): executa em transação, trava `[accountId, destinationAccountId?]` (para `TRANSFER`), valida referências e salva com `{ manager }`.
- [`UpdateTransactionUseCase`](../../../../../api/src/modules/transactions/application/use-cases/update-transaction/update-transaction.use-case.ts): executa em transação, trava a transaction (`findByIdAndUserIdForUpdate`), valida restrição de anexos quando aplicável, trava todas as contas antigas e novas envolvidas (`[oldAccountId, oldDestId, nextAccountId, nextDestId]`), valida referências e salva com `{ manager }`.
- [`ConfirmTransactionUseCase`](../../../../../api/src/modules/transactions/application/use-cases/confirm-transaction/confirm-transaction.use-case.ts): executa em transação, trava a transaction, valida status/anexos, trava todas as contas antigas e novas envolvidas, valida referências e salva com `{ manager }`.
- [`DeleteTransactionUseCase`](../../../../../api/src/modules/transactions/application/use-cases/delete-transaction/delete-transaction.use-case.ts): dentro da transação existente, após `transaction.delete()`, trava `[accountId, destinationAccountId?]` antes de salvar a exclusão lógica.

#### Use Case (`CreateBalanceAdjustmentUseCase`)
Localização: `api/src/modules/transactions/application/use-cases/create-balance-adjustment/`
- `create-balance-adjustment.dto.ts`:
  - `CreateBalanceAdjustmentUseCaseInput`: `{ userId, accountId, targetBalanceCents, date, description? }`
  - `CreateBalanceAdjustmentUseCaseOutput = Transaction`
- `create-balance-adjustment.use-case.ts`:
  1. Validar `Number.isSafeInteger(data.targetBalanceCents)` (caso contrário lançar `InvalidTransactionError`).
  2. Abrir `this.dataSource.transaction(async manager => ...)`:
     - `await this.accountBalanceLockPort.lockAccountsForBalanceMutation({ userId: data.userId, accountIds: [data.accountId] }, { manager });`
     - `const references = await this.transactionReferenceValidator.validate({ userId: data.userId, accountId: data.accountId, destinationAccountId: null, type: TransactionType.ADJUSTMENT }, { manager });`
     - `const currentBalanceCents = await this.accountBalanceQueryPort.getCurrentBalanceCents({ userId: data.userId, accountId: data.accountId }, { manager });`
     - Se `currentBalanceCents === null`, lançar `TransactionAccountUnavailableError`.
     - Calcular `delta = BigInt(data.targetBalanceCents) - BigInt(currentBalanceCents)`.
     - Se `delta === 0n`, lançar `new BalanceAdjustmentNoDifferenceError()`.
     - Definir `direction = delta > 0n ? TransactionDirection.INCREASE : TransactionDirection.DECREASE`.
     - Definir `absoluteDelta = delta > 0n ? delta : -delta`.
     - Se `absoluteDelta > BigInt(TRANSACTION_AMOUNT_CENTS_MAX)`, lançar `new InvalidTransactionError('Balance adjustment amount exceeds maximum allowed value.')`.
     - Resolver descrição: `const trimmed = data.description?.trim(); const description = trimmed && trimmed.length > 0 ? trimmed : TRANSACTION_BALANCE_ADJUSTMENT_DEFAULT_DESCRIPTION;`.
     - Criar entidade via `TransactionFactory.create({ userId, accountId, destinationAccountId: null, categoryId: references.category.id, type: TransactionType.ADJUSTMENT, status: TransactionStatus.EFFECTIVE, amountCents: Number(absoluteDelta), date: data.date, description, direction })`.
     - Persistir via `this.transactionRepository.save(transaction, { manager })`.
     - Retornar a `Transaction` salva.

#### Presentation (DTO e Controller)
- `CreateBalanceAdjustmentDto` em `api/src/modules/transactions/presentation/dto/create-balance-adjustment.dto.ts`:
  - `accountId`: `@IsUUID()`
  - `targetBalanceCents`:
    - Preserva o valor bruto de `obj[key]` via `@Transform` antes da conversão implícita global (`enableImplicitConversion: true`), impedindo que `null`, `""`, `false`, `true` ou `[]` sejam convertidos silenciosamente em `0`/`1`.
    - `@IsInt()`, `@Min(TRANSACTION_TARGET_BALANCE_CENTS_MIN)`, `@Max(TRANSACTION_TARGET_BALANCE_CENTS_MAX)`
  - `date`: `@IsDateOnly()`
  - `description`: `@IsOptional()`, `@IsString()`, `@MaxLength(TRANSACTION_DESCRIPTION_MAX_LENGTH)`
- [`TransactionsController`](../../../../../api/src/modules/transactions/presentation/http/transactions.controller.ts):
  - Rota `POST /transactions/balance-adjustments` (`@Post('balance-adjustments')`).
  - Decorators Swagger completos (`@ApiCookieAuth('accessToken')`, `@ApiOperation`, `@ApiResponse(201, TransactionResponseDto)`, `@ApiBadRequestResponse`, `@ApiConflictResponse`).
  - Retorna `TransactionResponseDto.fromDomain(transaction)`.
- [`TransactionsModule`](../../../../../api/src/modules/transactions/transactions.module.ts):
  - Registrar e exportar `CreateBalanceAdjustmentUseCase`.

## Schema e Migrations

- **Nenhuma alteração de schema** e **nenhuma migration** necessária.
- Reutiliza integralmente a tabela `transactions`, suas constraints (`CHK_transactions_amount_positive`, `CHK_transactions_type`, `CHK_transactions_direction`, `CHK_transactions_adjustment_description`, `CHK_transactions_effective_at`) e a categoria técnica `ADJUSTMENT`.
- `docs/database/schema.md` permanece válido sem mudanças.

## Segurança e Ownership

- `userId` sempre extraído de `@CurrentUser()`.
- Lock e consulta de conta sempre filtram por `id = accountId AND user_id = userId`, impedindo IDOR/BOLA.
- Consulta de saldo sempre filtra `accounts.user_id = $1` e `transactions.user_id = $1`.
- Categoria técnica sempre resolvida para o `userId` autenticado.
- `ValidationPipe` global com `whitelist: true` e `forbidNonWhitelisted: true` bloqueia campos indevidos como `userId`, `type`, `status`, `direction` ou `categoryId`.

## Estratégia de Testes

- **Unitários (`*.spec.ts`):**
  - `create-balance-adjustment.use-case.spec.ts`:
    - aumento de saldo (`target > current` → `INCREASE`);
    - redução de saldo (`target < current` → `DECREASE`);
    - saldo alvo negativo (`current > 0` para `target < 0` e `current < 0` para `target` mais negativo);
    - saldo alvo zero (`current < 0` para `0` → `INCREASE`; `current > 0` para `0` → `DECREASE`);
    - saldo alvo igual ao saldo atual (`delta === 0` → `BalanceAdjustmentNoDifferenceError`, sem salvar);
    - fallback de `description` (omitida, `null`, espaços em branco → `"Reajuste de saldo"`);
    - `description` customizada preservada com `trim()`;
    - erro quando `|delta| > TRANSACTION_AMOUNT_CENTS_MAX` (`InvalidTransactionError`);
    - erro quando `targetBalanceCents` não é inteiro seguro (`InvalidTransactionError`);
    - propagação de `TransactionAccountUnavailableError` e `TransactionCategoryUnavailableError`;
    - verificação de uso de `manager` na transação (lock + balance + save).
  - `create-balance-adjustment.dto.spec.ts`:
    - validação com `ValidationPipe` (`enableImplicitConversion: true`, `whitelist: true`, `forbidNonWhitelisted: true`) garantindo aceitação de `0`, negativos, positivos e rejeição de `null`, `""`, `false`, floats, `date` inválida e campos extras.
  - `app-exception.filter.spec.ts`:
    - mapeamento de `BalanceAdjustmentNoDifferenceError` para `409 Conflict` com `code: 'BALANCE_ADJUSTMENT_NO_DIFFERENCE'`.
- **Verificações globais:**
  - `npm run typecheck`, `npm run lint:check`, `npm test`, `npm run test:e2e`, `npm run build`.

## Impacto em Documentação

- Preencher `docs/transactions/flows/balance-adjustment.md` (migrando de `draft` para `current`, cobrindo o fluxo automático por saldo alvo e o lançamento manual em `POST /transactions`).
- Criar `docs/integrations/transactions/create-balance-adjustment.md` e indexar em `docs/integrations/transactions/README.md`.
- Atualizar `docs/integrations/errors.md` com `BALANCE_ADJUSTMENT_NO_DIFFERENCE` (`409`).
- Atualizar `docs/transactions/README.md` e `docs/specs/README.md`.
