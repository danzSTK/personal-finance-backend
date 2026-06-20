---
area: database
type: reference
status: current
---

# Schema do Banco

Esta nota descreve o schema esperado após aplicar as migrations atuais do projeto.

Fonte de verdade usada para esta documentação:

- Entidades registradas em `api/src/config/entities.ts`.
- Migrations em `api/src/database/migrations/`.
- Regras de domínio já documentadas em [Auth](../auth/README.md) e [Accounts](../accounts/README.md).

Tabelas internas criadas pelo TypeORM, como a tabela de controle de migrations, não entram neste documento.

## Visão Geral

| Tabela            | Responsabilidade                                                                    |
| ----------------- | ----------------------------------------------------------------------------------- |
| `users`           | Identidade principal do usuário dentro do sistema.                                  |
| `auth_providers`  | Formas de autenticação vinculadas a um usuário, como `EMAIL` e `GOOGLE`.            |
| `accounts`        | Contas financeiras do usuário, como `CASH`, `BANK`, `CREDIT_CARD` e `INVESTMENT`.   |
| `categories`      | Categorias financeiras de receita/despesa do usuário.                               |
| `transactions`    | Movimentações financeiras registradas para usuário, conta e categoria.              |
| `assets`          | Metadados e ciclo de vida dos objetos armazenados no Object Storage.                 |
| `outbox_messages` | Mensagens do transactional outbox para publicar eventos de domínio com resiliência. |

## Convenções

- `id` usa `uuid` gerado no banco com `gen_random_uuid()`.
- `created_at` registra criação da linha.
- `updated_at` é atualizado pela função `set_updated_at()` via trigger nas tabelas criadas pelas migrations.
- Dados multi-tenant são sempre ligados a `user_id`.
- Soft delete legado usa `is_active` e `deactivated_at`.
- Arquivamento de account usa `is_archived`, não `is_active`.

## `users`

Representa a identidade principal do usuário. É a raiz que conecta autenticação, contas, categorias e transações.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador interno do usuário. É referenciado por quase todo dado multi-tenant. |
| `email` | `varchar(255)` | `not null` | E-mail principal do usuário. Também é usado como chave de busca no login por credenciais. |
| `user_name` | `varchar(255)` | `nullable` | Nome de usuário opcional para perfil/identificação pública. |
| `first_name` | `varchar(255)` | `nullable` | Primeiro nome do usuário. |
| `last_name` | `varchar(255)` | `nullable` | Sobrenome do usuário. |
| `status` | `varchar(50)` | `not null default 'PENDING_PROFILE'` | Estado operacional do usuário: `PENDING_PROFILE`, `ACTIVE` ou `BLOCKED`. |
| `avatar_asset_id` | `uuid` | `nullable` | Referência ao asset que representa o avatar atual do usuário. |
| `created_at` | `timestamptz` | `not null default now()` | Quando o usuário foi criado. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização do usuário. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_users` | primary key | `id` | Garante identidade única da linha. |
| `CHK_users_status` | check | `status IN ('PENDING_PROFILE', 'ACTIVE', 'BLOCKED')` | Impede estados de usuário fora do contrato do domínio. |
| `UQ_074a1f262efaca6aba16f7ed920` | unique | `user_name` | Evita dois usuários com o mesmo `user_name`. A entidade declara o nome lógico `UQ_user_name`, mas a migration histórica criou esse nome automático. |
| `UQ_users_avatar_asset_id` | unique | `avatar_asset_id` | Impede que o mesmo asset seja usado como avatar atual por usuários diferentes. |
| `FK_users_avatar_asset` | foreign key | `avatar_asset_id -> assets.id ON DELETE SET NULL` | Mantém o usuário válido caso uma linha de asset seja removida fisicamente. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_users_email` | `email`, unique | Busca rápida por e-mail e garantia de e-mail principal único. |
| `idx_users_status` | `status` | Filtra usuários por status, útil para consultas administrativas ou rotinas. |

### Relacionamentos

| Relacionamento | Regra | Utilidade |
| --- | --- | --- |
| `auth_providers.user_id -> users.id` | `ON DELETE CASCADE` | Remove providers quando o usuário é removido. |
| `accounts.user_id -> users.id` | `ON DELETE CASCADE` | Remove contas quando o usuário é removido. |
| `categories.user_id -> users.id` | `ON DELETE CASCADE` | Remove categorias quando o usuário é removido. |
| `transactions.user_id -> users.id` | `ON DELETE CASCADE` | Remove transações quando o usuário é removido. |
| `assets.user_id -> users.id` | `ON DELETE RESTRICT` | Exige que os objetos do usuário sejam tratados antes de remover sua identidade. |
| `users.avatar_asset_id -> assets.id` | `ON DELETE SET NULL` | Identifica o avatar atual sem fazer o módulo users armazenar dados do R2. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_users_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

## `auth_providers`

Representa um método de autenticação vinculado a um usuário. Um usuário pode ter `GOOGLE` e `EMAIL` ao mesmo tempo.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador do vínculo de autenticação. |
| `user_id` | `uuid` | `not null` | Dono do provider. |
| `provider` | `varchar(50)` | `not null` | Tipo do provider, como `EMAIL`, `GOOGLE` ou `APPLE`. |
| `provider_user_id` | `varchar(255)` | `not null` | Identificador externo ou lógico do provider. Para `EMAIL`, é o e-mail; para `GOOGLE`, é o id do Google. |
| `password_hash` | `varchar(255)` | `nullable` | Hash da senha para provider `EMAIL`. Deve ficar `null` para OAuth. |
| `created_at` | `timestamptz` | `not null default now()` | Quando o provider foi vinculado. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização do vínculo. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_auth_providers` | primary key | `id` | Garante identidade única da linha. |
| `UQ_auth_providers` | unique | `(provider, provider_user_id)` | Impede que o mesmo identificador de provider seja vinculado a mais de um usuário. |
| `FK_auth_providers_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Garante que todo provider pertença a um usuário existente. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_auth_providers_user_id` | `user_id` | Lista providers de um usuário com rapidez. |

### Observações

- A regra "`password_hash` deve existir para `EMAIL` e ser `null` para OAuth" hoje é garantida pelo domínio, não por `CHECK` no banco.
- A tabela não tem `CHECK` para limitar `provider`. O enum da aplicação inclui `EMAIL`, `GOOGLE` e `APPLE`.

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_auth_providers_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

## `accounts`

Representa uma conta financeira do usuário. O saldo não é persistido aqui; ele é derivado de `initial_balance + receitas - despesas`.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da account. |
| `user_id` | `uuid` | `not null` | Dono da account. |
| `account_type` | `accounts_account_type_enum` | `not null` | Tipo da account: `CASH`, `BANK`, `CREDIT_CARD` ou `INVESTMENT`. |
| `name` | `varchar(255)` | `not null` | Nome exibido para o usuário. |
| `initial_balance` | `numeric(10,2)` | `not null default 0.00` | Saldo inicial usado no cálculo derivado do saldo. |
| `color` | `varchar(20)` | `nullable` | Cor visual da account. |
| `icon` | `varchar(100)` | `nullable` | Ícone visual da account. |
| `include_in_total` | `boolean` | `not null default true` | Define se a conta entra em totais e relatórios agregados. |
| `is_archived` | `boolean` | `not null default false` | Indica se a account está arquivada. |
| `is_default` | `boolean` | `not null default false` | Indica a conta default do usuário. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a account foi criada. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização da account. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_accounts` | primary key | `id` | Garante identidade única da account. |
| `FK_accounts_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Garante que toda account pertença a um usuário existente. |
| `CHK_accounts_type` | check | `account_type IN ('CASH', 'BANK', 'CREDIT_CARD', 'INVESTMENT')` | Protege o domínio contra tipos fora do contrato. |
| `CHK_accounts_default_not_archived` | check | `NOT (is_default = true AND is_archived = true)` | Impede que uma account arquivada continue marcada como default. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_accounts_user_id` | `user_id` | Lista contas por usuário. |
| `idx_accounts_user_not_archived` | `user_id WHERE is_archived = false` | Otimiza a listagem padrão de contas ativas/não arquivadas. |
| `UQ_accounts_user_default_active` | `user_id WHERE is_default = true AND is_archived = false`, unique | Garante no banco uma única account default ativa por usuário. |
| `UQ_accounts_user_cash` | `user_id WHERE account_type = 'CASH'`, unique | Garante no banco no máximo uma account `CASH` por usuário. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_accounts_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

## `categories`

Representa categorias financeiras do usuário. Ainda é uma tabela de produto inicial/legada, mas já define a separação entre receita e despesa.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da categoria. |
| `user_id` | `uuid` | `not null` | Dono da categoria. |
| `name` | `varchar(255)` | `not null` | Nome canônico usado para busca e agrupamento. |
| `label` | `varchar(255)` | `not null` | Rótulo exibido para o usuário. |
| `description` | `text` | `nullable` | Descrição opcional da categoria. |
| `type` | `varchar(20)` | `not null` | Tipo financeiro: `INCOME` ou `EXPENSE`. |
| `icon` | `varchar(100)` | `nullable` | Ícone visual da categoria. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a categoria foi criada. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização da categoria. |
| `is_active` | `boolean` | `not null default true` | Soft delete legado: define se a categoria está ativa. |
| `deactivated_at` | `timestamptz` | `nullable` | Momento de desativação quando `is_active = false`. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_categories` | primary key | `id` | Garante identidade única da categoria. |
| `FK_categories_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Garante que toda categoria pertença a um usuário existente. |
| `CHK_categories_type` | check | `type IN ('INCOME', 'EXPENSE')` | Impede categorias fora dos tipos financeiros suportados. |
| `CHK_categories_deactivation` | check | `(is_active = true AND deactivated_at IS NULL) OR (is_active = false AND deactivated_at IS NOT NULL)` | Mantém coerência entre estado ativo e data de desativação. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_categories_user_name_type_active` | `(user_id, name, type) WHERE is_active = true` | Busca categoria ativa por usuário, nome e tipo. |
| `idx_categories_user_type` | `(user_id, type) WHERE is_active = true` | Lista categorias ativas por tipo financeiro. |
| `idx_categories_user_active` | `user_id WHERE is_active = true` | Lista categorias ativas de um usuário. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_categories_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

## `transactions`

Representa movimentações financeiras. Cada transação pertence a um usuário, uma account e uma categoria.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da transação. |
| `user_id` | `uuid` | `not null` | Dono da transação. |
| `account_id` | `uuid` | `not null` | Conta afetada pela transação. |
| `category_id` | `uuid` | `not null` | Categoria usada para classificar a transação. |
| `amount` | `numeric(10,2)` | `not null` | Valor positivo da movimentação. O sinal financeiro vem da categoria/tipo de fluxo, não do número negativo. |
| `date` | `date` | `not null default NOW()` | Data financeira da transação. |
| `description` | `text` | `nullable` | Descrição opcional. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a transação foi criada. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização da transação. |
| `is_active` | `boolean` | `not null default true` | Soft delete legado: define se a transação está ativa. |
| `deactivated_at` | `timestamptz` | `nullable` | Momento de desativação quando `is_active = false`. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_transactions` | primary key | `id` | Garante identidade única da transação. |
| `FK_transactions_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Garante que a transação pertence a um usuário existente. |
| `FK_transactions_account` | foreign key | `account_id -> accounts.id ON DELETE CASCADE` | Garante que a transação pertence a uma account existente. |
| `FK_transactions_category` | foreign key | `category_id -> categories.id ON DELETE NO ACTION` | Impede remover categoria referenciada por transações. |
| `CHK_transactions_amount` | check | `amount > 0` | Impede valores zero ou negativos. |
| `CHK_transactions_deactivation` | check | `(is_active = true AND deactivated_at IS NULL) OR (is_active = false AND deactivated_at IS NOT NULL)` | Mantém coerência entre estado ativo e data de desativação. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_transactions_user_date_id` | `(user_id, date DESC, id DESC) WHERE is_active = true` | Página transações ativas por usuário em ordem cronológica estável. |
| `idx_transactions_user` | `user_id WHERE is_active = true` | Lista transações ativas por usuário. |
| `idx_transactions_account` | `account_id WHERE is_active = true` | Calcula/lista histórico ativo por account. |
| `idx_transactions_category` | `category_id WHERE is_active = true` | Calcula/lista histórico ativo por categoria. |
| `idx_transactions_user_date` | `(user_id, date) WHERE is_active = true` | Filtra transações ativas por usuário e intervalo/data. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_transactions_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

## `assets`

Representa o registro relacional dos objetos armazenados no Object Storage. Os bytes ficam no R2; esta tabela controla propriedade, finalidade, localização e ciclo de vida.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identidade do asset e componente estável da storage key. |
| `user_id` | `uuid` | `not null` | Proprietário do objeto para isolamento multi-tenant e autorização. |
| `purpose` | `varchar(50)` | `not null` | Finalidade estável do produto. Inicialmente aceita `USER_AVATAR`. |
| `status` | `varchar(30)` | `not null default 'PENDING_UPLOAD'` | Estado operacional do objeto: `PENDING_UPLOAD`, `READY`, `DELETE_PENDING`, `DELETED` ou `FAILED`. |
| `bucket` | `varchar(63)` | `not null` | Nome do bucket definido pela configuração do backend. Não faz parte da storage key. |
| `storage_key` | `varchar(1024)` | `not null` | Caminho relativo e único do objeto dentro do bucket. |
| `content_type` | `varchar(255)` | `nullable` | MIME type confirmado depois da validação e processamento. |
| `size_bytes` | `bigint` | `nullable` | Tamanho final do objeto armazenado, em bytes. |
| `checksum` | `varchar(64)` | `nullable` | SHA-256 hexadecimal minúsculo calculado sobre o arquivo final. |
| `metadata` | `jsonb` | `not null default '{}'` | Propriedades técnicas, como largura, altura e formato, sem regra de negócio. |
| `failure_code` | `varchar(100)` | `nullable` | Código operacional estável de falha; não contém HTTP status nem erro bruto do SDK. |
| `ready_at` | `timestamptz` | `nullable` | Momento em que o upload foi confirmado e o asset ficou disponível. |
| `deleted_at` | `timestamptz` | `nullable` | Momento em que a remoção física foi confirmada. |
| `created_at` | `timestamptz` | `not null default now()` | Quando o registro foi reservado. |
| `updated_at` | `timestamptz` | `not null default now()` | Última transição ou atualização operacional. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_assets` | primary key | `id` | Garante identidade única do asset. |
| `FK_assets_user` | foreign key | `user_id -> users.id ON DELETE RESTRICT` | Preserva metadata necessária à limpeza do R2 antes da exclusão do usuário. |
| `CHK_assets_purpose` | check | `purpose IN ('USER_AVATAR')` | Impede finalidades arbitrárias ou desconhecidas. |
| `CHK_assets_status` | check | status dentro do ciclo definido | Impede estados operacionais não reconhecidos. |
| `CHK_assets_bucket_not_empty` | check | bucket não vazio | Evita localização incompleta. |
| `CHK_assets_storage_key` | check | key não vazia e sem `/` inicial | Mantém a key relativa ao bucket. |
| `CHK_assets_size_bytes` | check | tamanho nulo ou não negativo | Impede tamanhos inválidos. |
| `CHK_assets_checksum` | check | SHA-256 hexadecimal minúsculo ou nulo | Garante formato consistente para integridade. |
| `CHK_assets_metadata` | check | JSONB deve ser objeto | Evita arrays e escalares no metadata técnico. |
| `CHK_assets_ready_state` | check | `READY` exige `ready_at` | Mantém coerência do upload confirmado. |
| `CHK_assets_deleted_state` | check | somente `DELETED` possui `deleted_at` | Mantém coerência da remoção física. |
| `CHK_assets_failure_state` | check | somente `FAILED` possui `failure_code` | Mantém coerência do diagnóstico operacional. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `UQ_assets_bucket_storage_key` | `(bucket, storage_key)`, unique | Garante que uma localização física represente somente um asset. |
| `idx_assets_user_purpose_status` | `(user_id, purpose, status)` | Busca os assets de um usuário por finalidade e estado. |
| `idx_assets_status_updated_at` | `(status, updated_at) WHERE status IN ('PENDING_UPLOAD', 'DELETE_PENDING', 'FAILED')` | Alimenta reconciliação e limpeza sem varrer assets saudáveis. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_assets_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em transições persistidas. |

Mais detalhes de domínio estão em [Assets](../assets/README.md).

## `outbox_messages`

Representa a fila transacional do padrão outbox. Cada linha é um evento de domínio salvo junto com a transação de negócio.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da mensagem de outbox. |
| `event_name` | `varchar(255)` | `not null` | Nome do evento, como `user.created`. |
| `event_version` | `integer` | `not null default 1` | Versão do contrato do evento. |
| `aggregate_type` | `varchar(100)` | `not null` | Tipo do aggregate que originou o evento, como `User` ou `Account`. |
| `aggregate_id` | `uuid` | `not null` | Identificador do aggregate que originou o evento. |
| `deduplication_key` | `varchar(255)` | `nullable` | Chave opcional para evitar duplicação lógica de evento. |
| `payload` | `jsonb` | `not null` | Dados necessários para reconstruir/publicar o evento. |
| `metadata` | `jsonb` | `not null default '{}'::jsonb` | Dados técnicos como correlation id, causation id e request id. |
| `status` | `varchar(30)` | `not null default 'PENDING'` | Estado operacional da mensagem: `PENDING`, `PROCESSING`, `PUBLISHED`, `FAILED` ou `DEAD`. |
| `attempts` | `integer` | `not null default 0` | Quantidade de tentativas de publicação. |
| `max_attempts` | `integer` | `not null default 10` | Limite de tentativas antes de mover para `DEAD`. |
| `next_retry_at` | `timestamptz` | `nullable` | Próximo momento em que a mensagem pode ser reprocessada. |
| `locked_by` | `varchar(100)` | `nullable` | Worker/processo que pegou a mensagem para processamento. |
| `locked_until` | `timestamptz` | `nullable` | Expiração do lock para recuperar mensagens presas. |
| `last_error` | `text` | `nullable` | Último erro de publicação/processamento. |
| `occurred_at` | `timestamptz` | `not null` | Momento em que o evento de domínio ocorreu. |
| `published_at` | `timestamptz` | `nullable` | Momento em que a mensagem foi publicada com sucesso. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a mensagem foi gravada na outbox. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização operacional da mensagem. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_outbox_messages` | primary key | `id` | Garante identidade única da mensagem. |
| `CHK_outbox_messages_status` | check | `status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'DEAD')` | Impede estados fora do ciclo operacional da outbox. |
| `CHK_outbox_messages_attempts` | check | `attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts` | Evita tentativas negativas e garante limite válido. |
| `CHK_outbox_messages_event_version` | check | `event_version > 0` | Garante versionamento positivo do contrato do evento. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `UQ_outbox_messages_deduplication_key` | `deduplication_key WHERE deduplication_key IS NOT NULL`, unique | Impede duplicação lógica de eventos idempotentes, como `user.created:<userId>`. |
| `idx_outbox_messages_ready` | `(status, next_retry_at, occurred_at) WHERE status IN ('PENDING', 'FAILED')` | Busca eficiente das mensagens prontas para processamento. |
| `idx_outbox_messages_expired_locks` | `locked_until WHERE status = 'PROCESSING'` | Permite recuperar mensagens presas por worker morto ou timeout. |
| `idx_outbox_messages_aggregate` | `(aggregate_type, aggregate_id, occurred_at)` | Rastreia todos os eventos emitidos por um aggregate. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_outbox_messages_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

## Objetos Auxiliares

### `set_updated_at()`

Função PostgreSQL criada pela migration inicial.

Responsabilidade:

- Atualizar `NEW.updated_at = NOW()` antes de cada update.
- Padronizar atualização automática de timestamps nas tabelas do app.

Usada por:

- `trg_users_updated_at`
- `trg_auth_providers_updated_at`
- `trg_accounts_updated_at`
- `trg_categories_updated_at`
- `trg_transactions_updated_at`
- `trg_assets_updated_at`
- `trg_outbox_messages_updated_at`

### `accounts_account_type_enum`

Enum PostgreSQL criado para `accounts.account_type`.

Valores:

- `CASH`
- `BANK`
- `CREDIT_CARD`
- `INVESTMENT`

Utilidade:

- Levar parte da regra de tipos de account para o banco.
- Reduzir risco de dados fora do contrato em imports, scripts ou bugs de aplicação.

## Pontos de Atenção

- `users.user_name` tem nome de unique diferente entre entidade (`UQ_user_name`) e migration histórica (`UQ_074a1f262efaca6aba16f7ed920`). Isso não muda a regra, mas pode aparecer em futuras gerações de migration.
- `auth_providers.provider` não tem `CHECK` no banco; a aplicação controla os valores.
- `auth_providers.password_hash` não tem `CHECK` condicional por provider; a aplicação controla se `EMAIL` exige senha e OAuth não permite senha.
- `categories` e `transactions` ainda usam `is_active/deactivated_at`, enquanto `accounts` já usa `is_archived`.
- `transactions.amount` está como `numeric(10,2)`. A regra de domínio financeira do projeto pede cuidado para não usar `number` em cálculo monetário na aplicação.
