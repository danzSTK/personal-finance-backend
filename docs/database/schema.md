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
| `email_verification_challenges` | Desafios de confirmação de e-mail por token com expiração e consumo. |
| `accounts`        | Contas financeiras do usuário, como `CASH`, `BANK`, `CREDIT_CARD` e `INVESTMENT`.   |
| `categories`      | Categorias financeiras e técnicas do usuário, incluindo receita, despesa, transferência, ajuste e investimento. |
| `transactions`    | Movimentações financeiras registradas para usuário, conta e categoria.              |
| `assets`          | Metadados e ciclo de vida dos objetos armazenados no Object Storage.                 |
| `email_messages`  | Intenções idempotentes de envio de e-mails transacionais.                           |
| `outbox_messages` | Mensagens do transactional outbox para publicar eventos de domínio com resiliência. |

## Convenções

- `id` usa `uuid` gerado no banco com `gen_random_uuid()`.
- `created_at` registra criação da linha.
- `updated_at` é atualizado pela função `set_updated_at()` via trigger nas tabelas criadas pelas migrations.
- Colunas `date` representam data civil (`DateOnly`) e não devem depender de timezone.
- Colunas `timestamptz` representam instantes (`Instant`) e devem ser trafegadas em UTC.
- Dados de domínio multi-tenant são ligados a `user_id`. Tabelas operacionais de integração podem usar identificadores de evento, aggregate ou chaves de idempotência, desde que não sejam expostas como recursos de usuário sem ownership explícito.
- Soft delete de transactions usa `deleted_at`.
- Arquivamento de cadastros usa `is_archived`/`archived_at` em `accounts` e `categories`.

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
| `status` | `varchar(50)` | `not null default 'PENDING_PROFILE'` | Estado operacional do usuário: `PENDING_PROFILE`, `PENDING_EMAIL_VERIFICATION`, `ACTIVE` ou `BLOCKED`. |
| `avatar_asset_id` | `uuid` | `nullable` | Referência ao asset que representa o avatar atual do usuário. |
| `created_at` | `timestamptz` | `not null default now()` | Quando o usuário foi criado. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização do usuário. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_users` | primary key | `id` | Garante identidade única da linha. |
| `CHK_users_status` | check | `status IN ('PENDING_PROFILE', 'PENDING_EMAIL_VERIFICATION', 'ACTIVE', 'BLOCKED')` | Impede estados de usuário fora do contrato do domínio. |
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
| `email_verification_challenges.user_id -> users.id` | `ON DELETE CASCADE` | Remove challenges quando o usuário é removido. |
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

## `email_verification_challenges`

Representa desafios de confirmação de e-mail. O token em claro nunca é persistido; o banco guarda apenas o hash usado para lookup durante a confirmação.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador interno do challenge. |
| `user_id` | `uuid` | `not null` | Usuário dono do challenge. |
| `email` | `varchar(255)` | `not null` | E-mail que receberá o link de verificação, validado pelas mesmas regras do e-mail principal do usuário. |
| `purpose` | `varchar(50)` | `not null` | Finalidade do challenge. Inicialmente `EMAIL_VERIFICATION`. |
| `token_hash` | `varchar(64)` | `not null` | SHA-256 hexadecimal do token. |
| `expires_at` | `timestamptz` | `not null` | Instante em que o token deixa de ser válido. |
| `consumed_at` | `timestamptz` | `nullable` | Instante de consumo do challenge. |
| `created_at` | `timestamptz` | `not null default now()` | Quando o challenge foi criado. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_email_verification_challenges` | primary key | `id` | Garante identidade única do challenge. |
| `FK_email_verification_challenges_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Remove challenges quando o usuário é removido. |
| `CHK_email_verification_challenges_purpose` | check | `purpose IN ('EMAIL_VERIFICATION')` | Impede finalidades fora do contrato atual. |
| `CHK_email_verification_challenges_token_hash_length` | check | `length(token_hash) = 64` | Garante formato SHA-256 hexadecimal. |
| `CHK_email_verification_challenges_expiration` | check | `expires_at > created_at` | Garante challenge com validade futura. |
| `CHK_email_verification_challenges_consumed_after_created` | check | `consumed_at IS NULL OR consumed_at >= created_at` | Mantém coerência temporal do consumo. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_email_verification_challenges_token` | `(purpose, token_hash)` | Lookup de confirmação por token. |
| `idx_email_verification_challenges_email_purpose_created_at` | `(email, purpose, created_at DESC)` | Cooldown e limite de envios por e-mail. |
| `idx_email_verification_challenges_user_purpose_created_at` | `(user_id, purpose, created_at DESC)` | Diagnóstico e consultas por usuário. |
| `idx_email_verification_challenges_unconsumed_expiration` | `(purpose, expires_at) WHERE consumed_at IS NULL` | Suporte a limpeza/reconciliação futura de challenges abertos. |

## `accounts`

Representa uma conta financeira do usuário. O saldo não é persistido aqui; ele é derivado de `initial_balance_cents + impactos de transactions`.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da account. |
| `user_id` | `uuid` | `not null` | Dono da account. |
| `account_type` | `accounts_account_type_enum` | `not null` | Tipo da account: `CASH`, `BANK`, `CREDIT_CARD` ou `INVESTMENT`. |
| `name` | `varchar(255)` | `not null` | Nome exibido para o usuário. |
| `initial_balance_cents` | `bigint` | `not null default 0` | Saldo inicial em centavos usado no cálculo derivado do saldo. |
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
| `CHK_accounts_initial_balance_cents` | check | `initial_balance_cents >= 0` | Impede saldo inicial negativo. |

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

Representa categorias financeiras do usuário. Categorias classificam transactions e carregam semântica financeira, como receita, despesa, transferência, ajuste ou investimento.

Mesmo categorias técnicas pertencem a um usuário. Isso mantém isolamento multi-tenant simples e evita registros globais compartilhados.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da categoria. |
| `user_id` | `uuid` | `not null` | Dono da categoria. |
| `name` | `varchar(255)` | `not null` | Nome canônico normalizado usado para busca, agrupamento e unicidade. Exemplo: `alimentacao`. |
| `display_name` | `varchar(255)` | `not null` | Nome exibido para o usuário, preservando acento, espaços e capitalização. Exemplo: `Alimentação`. |
| `description` | `text` | `nullable` | Descrição opcional da categoria. |
| `type` | `varchar(20)` | `not null` | Tipo financeiro: `INCOME`, `EXPENSE`, `TRANSFER`, `ADJUSTMENT` ou `INVESTMENT`. |
| `color_token` | `varchar(30)` | `nullable` | Token visual oficial de cor validado pela aplicação. Não salva hexadecimal livre. |
| `icon_key` | `varchar(50)` | `nullable` | Token visual oficial de ícone validado pela aplicação. Não salva SVG nem nome de componente do frontend. |
| `is_system` | `boolean` | `not null default false` | Indica categoria estrutural do sistema, como categorias técnicas `TRANSFER` e `ADJUSTMENT`. |
| `include_in_reports` | `boolean` | `not null default true` | Define se a categoria gerenciável entra em relatórios agregados. Não altera a semântica técnica de `TRANSFER`/`ADJUSTMENT`. |
| `is_archived` | `boolean` | `not null default false` | Indica se a categoria foi arquivada e não deve aparecer nem ser usada por padrão. |
| `archived_at` | `timestamptz` | `nullable` | Momento de arquivamento quando `is_archived = true`. |
| `sort_order` | `integer` | `not null default 0` | Ordem estável para apresentação e organização no frontend. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a categoria foi criada. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização da categoria. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_categories` | primary key | `id` | Garante identidade única da categoria. |
| `FK_categories_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Garante que toda categoria pertença a um usuário existente. |
| `CHK_categories_type` | check | `type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'INVESTMENT')` | Impede categorias fora dos tipos financeiros suportados pelo domínio atual. |
| `CHK_categories_name_normalized` | check | `name ~ '^[a-z]+(-[a-z]+)*$'` | Garante que o nome canônico esteja normalizado para busca e unicidade. |
| `CHK_categories_display_name_not_empty` | check | `length(btrim(display_name)) > 0` | Impede rótulo vazio ou composto só por espaços. |
| `CHK_categories_color_token_not_empty` | check | `color_token IS NULL OR length(btrim(color_token)) > 0` | Impede token de cor vazio quando informado. |
| `CHK_categories_icon_key_not_empty` | check | `icon_key IS NULL OR length(btrim(icon_key)) > 0` | Impede token de ícone vazio quando informado. |
| `CHK_categories_sort_order` | check | `sort_order >= 0` | Mantém ordem de apresentação como inteiro não negativo. |
| `CHK_categories_archive_state` | check | `(is_archived = false AND archived_at IS NULL) OR (is_archived = true AND archived_at IS NOT NULL)` | Mantém coerência entre estado arquivado e momento de arquivamento. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `UQ_categories_user_type_name_not_archived` | `(user_id, type, name) WHERE is_archived = false`, unique | Garante que não existam duas categorias não arquivadas com mesmo nome canônico e tipo para o mesmo usuário. |
| `idx_categories_user_type_not_archived` | `(user_id, type) WHERE is_archived = false` | Lista categorias não arquivadas por usuário e tipo. |
| `idx_categories_user_not_archived` | `user_id WHERE is_archived = false` | Otimiza a listagem padrão de categorias visíveis/não arquivadas. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_categories_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

Mais detalhes de domínio estão em [Categories](../categories/README.md).

## `transactions`

Representa lançamentos financeiros do usuário. Cada transaction pertence a um usuário, usa uma categoria e impacta uma ou duas accounts dependendo do tipo.

O schema atual sustenta quatro tipos de lançamento:

- `INCOME`: entrada de dinheiro;
- `EXPENSE`: saída de dinheiro;
- `TRANSFER`: movimentação interna entre duas accounts do próprio usuário;
- `ADJUSTMENT`: correção técnica de saldo.

Transactions pendentes não afetam saldo atual. Apenas transactions `EFFECTIVE` e não deletadas entram nos cálculos de saldo corrente.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador da transação. |
| `user_id` | `uuid` | `not null` | Dono da transação. |
| `account_id` | `uuid` | `not null` | Account principal da transaction. Para `TRANSFER`, é a account de origem. |
| `destination_account_id` | `uuid` | `nullable` | Account de destino quando `type = TRANSFER`. Deve ser nula nos demais tipos. |
| `category_id` | `uuid` | `not null` | Categoria usada para classificar a transação. |
| `type` | `varchar(20)` | `not null` | Natureza financeira: `INCOME`, `EXPENSE`, `TRANSFER` ou `ADJUSTMENT`. |
| `status` | `varchar(20)` | `not null` | Estado financeiro: `PENDING` ou `EFFECTIVE`. |
| `amount_cents` | `bigint` | `not null` | Valor absoluto em centavos. Exemplo: R$ 19,20 é salvo como `1920`. |
| `date` | `date` | `not null default CURRENT_DATE` | Data financeira principal usada para histórico, filtros e ordenação. |
| `effective_at` | `timestamptz` | `nullable` | Momento em que a transaction deixou de ser previsão e passou a ser realidade financeira. |
| `description` | `text` | `nullable` | Descrição opcional. Para `ADJUSTMENT`, funciona como motivo obrigatório do ajuste. |
| `direction` | `varchar(20)` | `nullable` | Direção do ajuste: `INCREASE` ou `DECREASE`. Só pode existir quando `type = ADJUSTMENT`. |
| `deleted_at` | `timestamptz` | `nullable` | Soft delete do lançamento. Quando preenchido, a transaction sai de listagens e cálculos comuns. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a transação foi criada. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização da transação. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_transactions` | primary key | `id` | Garante identidade única da transação. |
| `FK_transactions_user` | foreign key | `user_id -> users.id ON DELETE CASCADE` | Garante que a transação pertence a um usuário existente. |
| `FK_transactions_account` | foreign key | `account_id -> accounts.id ON DELETE RESTRICT` | Garante que a account principal exista e impede apagar account com histórico financeiro. |
| `FK_transactions_destination_account` | foreign key | `destination_account_id -> accounts.id ON DELETE RESTRICT` | Garante que a account destino exista em transferências e impede apagar account com histórico de destino. |
| `FK_transactions_category` | foreign key | `category_id -> categories.id ON DELETE NO ACTION` | Impede remover categoria referenciada por transações. |
| `CHK_transactions_type` | check | `type IN ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT')` | Impede tipos fora do contrato da V0. |
| `CHK_transactions_status` | check | `status IN ('PENDING', 'EFFECTIVE')` | Impede estados persistidos fora do contrato da V0. |
| `CHK_transactions_amount_cents` | check | `amount_cents > 0` | Impede valores zero ou negativos e mantém amount como valor absoluto. |
| `CHK_transactions_effective_at_status` | check | `PENDING` exige `effective_at IS NULL`; `EFFECTIVE` exige `effective_at IS NOT NULL` | Mantém coerência entre planejamento e realidade financeira. |
| `CHK_transactions_transfer_destination` | check | `TRANSFER` exige `destination_account_id` preenchida e diferente de `account_id`; outros tipos exigem `destination_account_id IS NULL` | Garante transferência composta em uma linha sem destino inválido. |
| `CHK_transactions_direction` | check | `ADJUSTMENT` exige `direction IN ('INCREASE', 'DECREASE')`; outros tipos exigem `direction IS NULL` | Mantém direção exclusiva para ajuste de saldo. |
| `CHK_transactions_adjustment_description` | check | `type <> 'ADJUSTMENT' OR length(btrim(description)) > 0` | Garante motivo/observação em ajustes técnicos. |
| `CHK_transactions_transfer_not_deleted` | check | `type <> 'TRANSFER' OR deleted_at IS NULL` | Impede soft delete de transferências na V0; correções devem ser feitas por transferência inversa. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `idx_transactions_user_date_id` | `(user_id, date DESC, id DESC) WHERE deleted_at IS NULL` | Página transactions não deletadas por usuário em ordem cronológica estável. |
| `idx_transactions_user_status_date` | `(user_id, status, date DESC, id DESC) WHERE deleted_at IS NULL` | Lista pendências/efetivadas por usuário sem varrer histórico deletado. |
| `idx_transactions_account_effective` | `(user_id, account_id, date) WHERE deleted_at IS NULL AND status = 'EFFECTIVE'` | Calcula saldo e histórico real da account principal. |
| `idx_transactions_destination_account_effective` | `(user_id, destination_account_id, date) WHERE deleted_at IS NULL AND status = 'EFFECTIVE' AND destination_account_id IS NOT NULL` | Calcula saldo e histórico real quando a account aparece como destino de transferência. |
| `idx_transactions_category_date` | `(user_id, category_id, date DESC) WHERE deleted_at IS NULL` | Alimenta relatórios/listagens por categoria sem incluir transactions deletadas. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_transactions_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

Mais detalhes de domínio estão em [Transactions](../transactions/README.md).

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

## `email_messages`

Representa uma intenção idempotente de envio de e-mail transacional. A tabela guarda o estado atual da mensagem, os parâmetros de template usados no provider e o diagnóstico da última falha, mas não funciona como log detalhado de tentativas.

O v1 usa essa tabela para o e-mail de boas-vindas disparado por `user.created`. A execução assíncrona fica na fila BullMQ `notifications.email`, e o `jobId` é derivado de `email_messages.id`, mas não é persistido.

### Colunas

| Coluna | Tipo | Nulo/default | Responsabilidade |
| --- | --- | --- | --- |
| `id` | `uuid` | `default gen_random_uuid()` | Identificador interno da intenção de e-mail. Também é usado para derivar o job id da fila. |
| `type` | `varchar(50)` | `not null` | Tipo lógico do e-mail, inicialmente `WELCOME`. |
| `recipient_email` | `varchar(320)` | `not null` | Endereço de destino usado pelo provider de e-mail. |
| `recipient_name` | `varchar(120)` | `nullable` | Nome exibível do destinatário quando disponível. |
| `provider` | `varchar(50)` | `not null` | Provider de envio usado na intenção, como `brevo`. |
| `template_key` | `varchar(100)` | `not null` | Chave interna documentada do template, como `welcome-email`. |
| `provider_template_id` | `varchar(100)` | `not null` | Identificador do template no provider externo, como `2` na Brevo. |
| `template_params` | `jsonb` | `not null default '{}'::jsonb` | Parâmetros enviados ao template. Deve ser objeto JSON. |
| `idempotency_key` | `varchar(255)` | `not null` | Chave de negócio que impede duplicidade lógica. Para welcome: `email:welcome:user:<userId>`. |
| `status` | `varchar(30)` | `not null default 'PENDING'` | Estado operacional: `PENDING`, `PROCESSING`, `SENT`, `FAILED_RETRYABLE`, `FAILED_PERMANENT` ou `CANCELED`. |
| `provider_message_id` | `varchar(255)` | `nullable` | Identificador retornado pelo provider quando o envio é aceito. |
| `attempts_count` | `integer` | `not null default 0` | Quantidade de tentativas registradas pela aplicação. |
| `last_error_code` | `varchar(100)` | `nullable` | Código estável do último erro de envio. |
| `last_error_message` | `text` | `nullable` | Mensagem sanitizada do último erro de envio. |
| `processing_at` | `timestamptz` | `nullable` | Momento em que o worker iniciou o processamento atual ou mais recente. |
| `sent_at` | `timestamptz` | `nullable` | Momento em que o provider aceitou o envio. |
| `failed_at` | `timestamptz` | `nullable` | Momento da última falha registrada. |
| `created_at` | `timestamptz` | `not null default now()` | Quando a intenção foi criada. |
| `updated_at` | `timestamptz` | `not null default now()` | Última atualização da intenção. |

### Constraints

| Nome | Tipo | Regra | Utilidade |
| --- | --- | --- | --- |
| `PK_email_messages_id` | primary key | `id` | Garante identidade única da intenção de e-mail. |
| `CHK_email_messages_status` | check | `status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED_RETRYABLE', 'FAILED_PERMANENT', 'CANCELED')` | Impede estados fora do ciclo operacional de notifications. |
| `CHK_email_messages_attempts_count` | check | `attempts_count >= 0` | Impede contador de tentativas negativo. |
| `CHK_email_messages_template_params_object` | check | `jsonb_typeof(template_params) = 'object'` | Garante que os parâmetros de template sejam sempre objeto JSON. |

### Índices

| Nome | Colunas/filtro | Utilidade |
| --- | --- | --- |
| `UQ_email_messages_idempotency_key` | `idempotency_key`, unique | Impede duplicidade lógica de uma intenção de e-mail. |
| `idx_email_messages_status_created_at` | `(status, created_at)` | Lista intenções por estado operacional e idade. |
| `idx_email_messages_recipient_email_created_at` | `(recipient_email, created_at)` | Ajuda diagnóstico por destinatário. |
| `idx_email_messages_type_created_at` | `(type, created_at)` | Ajuda diagnóstico e relatórios operacionais por tipo de e-mail. |

### Relacionamentos

| Relacionamento | Regra | Utilidade |
| --- | --- | --- |
| Nenhum FK no v1 | A intenção usa `idempotency_key` e dados necessários ao envio. | Evita acoplar o histórico operacional de envio ao ciclo de vida físico do usuário. |

### Triggers

| Nome | Função | Utilidade |
| --- | --- | --- |
| `trg_email_messages_updated_at` | `set_updated_at()` | Atualiza `updated_at` automaticamente em updates. |

### Observações

- `idempotency_key` pode usar `:` porque é uma chave de aplicação/banco, não um `jobId` BullMQ.
- A tabela não possui `job_id` nem `bullmq_job_id`; o job id é reconstruído como `email-message-<emailMessage.id>`.
- A tabela não substitui `email_delivery_attempts`. Um log detalhado de tentativas deve ser criado em spec futura, se necessário.
- Esta tabela contém e-mail de destinatário e parâmetros de template. Não exponha esses dados em endpoint de usuário sem uma spec que modele ownership, autorização e retenção.

Mais detalhes de domínio estão em [Notifications](../notifications/README.md) e no catálogo de [templates de e-mail](../notifications/email-templates/README.md).

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
- `trg_email_messages_updated_at`
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
- `transactions` usa `amount_cents` como `bigint`; a aplicação deve converter entrada/saída monetária sem usar `number` para cálculo financeiro.
- O banco protege coerência interna da linha de transaction, mas compatibilidade semântica entre `transaction.type` e `categories.type` ainda deve ser validada na aplicação.
- O banco protege FKs simples para account/category; ownership multi-tenant entre `transactions.user_id`, accounts e categories ainda deve ser validado na aplicação.
- `email_messages` é tabela operacional de envio. Ela não deve ser tratada como recurso multi-tenant de usuário sem uma spec futura que adicione ownership explícito ou defina uma política de exposição segura.
