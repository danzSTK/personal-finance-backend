---
area: accounts
feature: account-templates
type: spec-design
status: approved
issue: 91
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../accounts/decisions/account-visual-identity-uses-templates.md
  - ../../../../accounts/decisions/institutional-account-template-catalog-is-curated.md
  - ../../../../accounts/decisions/institutional-template-assets-use-controlled-storage.md
  - ../../../../accounts/decisions/account-template-rollout-preserves-v0-3.md
  - ../../../../database/schema.md
  - ../../../../database/migration-rollout.md
  - ../../../../architecture/compatibility.md
  - ../../../../platform/continuous-delivery.md
---

# Design - Account Templates

## Resumo Arquitetural

`Account` continua sendo o aggregate financeiro e passa a guardar apenas `templateId` como referência visual. `AccountTemplate` é um aggregate separado dentro do bounded context `accounts`.

```text
HTTP request
  -> AccountsController / AccountTemplatesController
    -> use case
      -> IAccountRepository
      -> IAccountTemplateRepository
        -> PostgreSQL

response
  <- AccountResponseDto
     + AccountTemplateResponseDto
     + URL pública derivada por IObjectStorage
```

Consulta à BrasilAPI, download dos SVGs indicados por `logo_url` e upload para o R2 existem somente em comandos explícitos de curadoria. O runtime HTTP, o worker normal e o seed usam exclusivamente dados internos.

## Camadas E Componentes

### Domain

Adicionar:

```text
api/src/modules/accounts/domain/
├── entities/account-template.entity.ts
├── enums/account-template-type.enum.ts
├── repositories/account-template.repository.interface.ts
└── value-objects/
    ├── account-template-color-token.value-object.ts
    └── account-template-storage-key.value-object.ts
```

Alterar `Account` para substituir a responsabilidade de `color`/`icon` por `templateId: string | null`. A nulabilidade é transitória e representa linhas/escritas legadas durante `DB-COMPAT-002`; não é a invariante final do produto.

`AccountTemplate` expõe getters imutáveis e diferencia:

- `INSTITUTIONAL`: global, sem owner, com metadados bancários e logo em storage;
- `CUSTOM`: pertencente a um usuário, com tokens visuais opcionais.

O domínio não importa NestJS, TypeORM, S3/R2, BrasilAPI nem tipos HTTP.

### Application

Adicionar use cases:

```text
application/use-cases/
├── list-account-templates/
├── reconcile-legacy-account-templates/
└── seed-institutional-account-templates/
```

Alterar create/update/list de accounts para:

- receber uma união discriminada de aplicação para seleção institucional ou definição customizada;
- validar a referência institucional com `findActiveInstitutionalById(templateId)` e confirmar o tipo persistido;
- criar/atualizar template customizado para payload legado;
- persistir template e account na mesma transação;
- carregar templates em lote na listagem;
- produzir o modelo necessário ao response sem expor entidade ORM.

Leituras usam duas operações distintas:

- `findActiveInstitutionalById`: exige tipo institucional e ativo; serve para nova associação;
- `findByIdsForRendering`: retorna templates já associados, inclusive institucionais inativos, sem permitir seleção indevida.

### Infrastructure

Adicionar:

```text
infrastructure/
├── mappers/account-template.mapper.ts
└── persistence/
    ├── account-template-orm.entity.ts
    └── account-template.repository.ts
```

O repository de account persiste `template_id`. A listagem de templates deve ser batch, sem uma query por account.

Não haverá cache próprio de templates na primeira versão. O cache atual de accounts manterá `color`/`icon` e adicionará campos opcionais do template. Assim:

- cache escrito pela v0.3 pode ser lido pela imagem nova via fallback;
- cache escrito pela imagem nova mantém os campos que a v0.3 espera;
- campos JSON extras são ignorados pela v0.3;
- a remoção dos campos legados do cache faz parte do contract.

### Presentation

Adicionar:

```text
presentation/
├── dto/account-template.response.dto.ts
└── http/account-templates.controller.ts
```

`CreateAccountDto` e `UpdateAccountDto` recebem `template` como objeto discriminado por `type`, com validação aninhada e schemas Swagger `oneOf`. `AccountResponseDto` ganha `object`, `templateId` e `template`, mantendo `color` e `icon` marcados como deprecated no Swagger.

O discriminador HTTP usa `institutional`/`custom` somente para selecionar o branch do comando. O controller o transforma numa união discriminada da aplicação. Nenhum mapper copia esse valor para `account_templates.template_type`: seleção institucional confirma o tipo já persistido; criação customizada usa exclusivamente `AccountTemplateFactory.createCustom()`.

## Modelo De Dados

### Nova Tabela `account_templates`

| Coluna             | Tipo inicial    | Nulo/default                | Responsabilidade                                                  |
| ------------------ | --------------- | --------------------------- | ----------------------------------------------------------------- |
| `id`               | `uuid`          | `default gen_random_uuid()` | Identidade estável do template.                                   |
| `template_type`    | `varchar(20)`   | `not null`                  | `INSTITUTIONAL` ou `CUSTOM`.                                      |
| `owner_user_id`    | `uuid`          | nullable                    | Owner de template customizado; nulo para institucional.           |
| `catalog_key`      | `varchar(80)`   | nullable                    | Chave estável do item institucional, como `nubank`.               |
| `name`             | `varchar(255)`  | `not null`                  | Nome de exibição do template.                                     |
| `color_token`      | `varchar(30)`   | nullable                    | Token interpretado pelo frontend. Obrigatório para institucional. |
| `icon_key`         | `varchar(50)`   | nullable                    | Ícone do catálogo interno para template customizado.              |
| `logo_storage_key` | `varchar(1024)` | nullable                    | Storage key relativa do logo institucional.                       |
| `bank_code`        | `smallint`      | nullable                    | Código bancário versionado da BrasilAPI.                          |
| `ispb`             | `varchar(8)`    | nullable                    | ISPB versionado da BrasilAPI.                                     |
| `is_active`        | `boolean`       | `not null default true`     | Selecionabilidade no catálogo.                                    |
| `created_at`       | `timestamptz`   | `not null default now()`    | Criação.                                                          |
| `updated_at`       | `timestamptz`   | `not null default now()`    | Última atualização.                                               |

A `logo_url` externa não é necessária no runtime e fica no catálogo fonte versionado, não na tabela. Bucket, URL externa e URL pública também não são persistidos.

### Constraints

| Nome planejado                                 | Regra                                                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PK_account_templates`                         | primary key em `id`.                                                                                                                                    |
| `FK_account_templates_owner_user`              | `owner_user_id -> users.id ON DELETE CASCADE`.                                                                                                          |
| `CHK_account_templates_type`                   | tipo em `INSTITUTIONAL`, `CUSTOM`.                                                                                                                      |
| `CHK_account_templates_owner`                  | institucional exige owner nulo; custom exige owner não nulo.                                                                                            |
| `CHK_account_templates_institutional_metadata` | institucional exige `catalog_key`, `color_token`, `logo_storage_key`, `bank_code` e `ispb`; custom não persiste metadados bancários/logo institucional. |
| `CHK_account_templates_storage_key`            | key não vazia e sem `/` inicial.                                                                                                                        |
| `CHK_account_templates_ispb`                   | nulo ou exatamente oito dígitos.                                                                                                                        |
| `CHK_account_templates_bank_code`              | nulo ou entre 1 e 999.                                                                                                                                  |
| `FK_accounts_template`                         | `accounts.template_id -> account_templates.id ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`.                                                       |

Não haverá `CHECK` enumerando `color_token`: incluir uma instituição não deve exigir migration. A allowlist vive em constantes de domínio/aplicação e no catálogo versionado. O banco protege formato, tipo e coerência estrutural.

### Índices

| Nome planejado                        | Definição                                                   | Motivo                                   |
| ------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| `UQ_account_templates_catalog_key`    | unique em `catalog_key WHERE catalog_key IS NOT NULL`       | Idempotência e identidade institucional. |
| `UQ_account_templates_bank_code`      | unique em `bank_code WHERE template_type = 'INSTITUTIONAL'` | Evita duplicar instituição por código.   |
| `UQ_account_templates_ispb`           | unique em `ispb WHERE template_type = 'INSTITUTIONAL'`      | Evita duplicar instituição por ISPB.     |
| `idx_account_templates_owner_user_id` | `owner_user_id WHERE template_type = 'CUSTOM'`              | Busca privada e ownership.               |
| `idx_accounts_template_id`            | `accounts(template_id)`                                     | Join e verificação da FK/referências.    |

Não é necessário índice de ativos para um catálogo inicial de dez linhas. Antes de adicionar outro índice, usar `EXPLAIN (ANALYZE, BUFFERS)` com cardinalidade representativa.

Os índices da tabela nova podem ser criados normalmente enquanto ela está vazia. Antes de criar `idx_accounts_template_id` na tabela existente, medir quantidade de linhas, tamanho de `accounts` e taxa de escrita. Se a criação comum puder bloquear produção de forma relevante, usar uma migration TypeORM não transacional dedicada com `CREATE INDEX CONCURRENTLY`; a escolha deve ser registrada antes do SQL.

`account_templates.updated_at` reutiliza `set_updated_at()` por meio de `trg_account_templates_updated_at`; nenhuma função duplicada será criada.

### Alteração Em `accounts`

Fase expand:

```sql
ALTER TABLE accounts ADD COLUMN template_id uuid NULL;
ALTER TABLE accounts
  ADD CONSTRAINT FK_accounts_template
  FOREIGN KEY (template_id) REFERENCES account_templates(id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX idx_accounts_template_id ON accounts(template_id);
```

`color` e `icon` não mudam nesta fase.

Estado final planejado para o contract da v0.5:

```sql
ALTER TABLE accounts ALTER COLUMN template_id SET NOT NULL;
ALTER TABLE accounts DROP COLUMN color;
ALTER TABLE accounts DROP COLUMN icon;
```

Esse SQL final é apenas o alvo. Ele exige nova migration e `DB-COMPAT-002` em `READY_TO_CONTRACT`.

## Contrato HTTP

### Listar Catálogo

```http
GET /account-templates
```

Retorna somente templates institucionais ativos:

```json
[
  {
    "object": "account_template.item",
    "id": "uuid",
    "type": "INSTITUTIONAL",
    "name": "Nubank",
    "colorToken": "nubank",
    "iconKey": null,
    "logoUrl": "https://public.example/banking-institutions-icons/nubank.svg",
    "bankCode": 260,
    "ispb": "18236120"
  }
]
```

O response nunca expõe `ownerUserId`, bucket ou storage key.

### Criar/Atualizar Account - Contrato Novo Institucional

```json
{
  "name": "Conta principal",
  "type": "BANK",
  "template": {
    "type": "institutional",
    "templateId": "uuid"
  }
}
```

### Criar/Atualizar Account - Contrato Novo Customizado

```json
{
  "name": "Carteira de viagens",
  "type": "CASH",
  "template": {
    "type": "custom",
    "colorToken": "blue",
    "iconKey": "wallet"
  }
}
```

No `POST`, campos visuais customizados ausentes produzem `null`. No `PATCH`, campos ausentes preservam os valores do template customizado atual; ao trocar de institucional para custom, campos ausentes começam em `null`. `template` é opcional somente durante o período compatível: quando ausente, o adaptador usa `color`/`icon` legados ou defaults para materializar/manter um template customizado.

### Criar/Atualizar Account - Contrato Legado

```json
{
  "name": "Conta principal",
  "type": "BANK",
  "color": "purple",
  "icon": "landmark"
}
```

`color`/`icon` permanecem validados pela allowlist v0.3. Se `template` aparecer junto de qualquer um deles, o request retorna `400` com código público específico para combinação inválida.

### Response Compatível

```json
{
  "object": "account.item",
  "id": "uuid",
  "name": "Nubank",
  "type": "BANK",
  "templateId": "uuid",
  "template": {
    "object": "account_template.item",
    "id": "uuid",
    "type": "INSTITUTIONAL",
    "name": "Nubank",
    "colorToken": "nubank",
    "iconKey": null,
    "logoUrl": "https://public.example/banking-institutions-icons/nubank.svg",
    "bankCode": 260,
    "ispb": "18236120"
  },
  "color": "purple",
  "icon": "landmark",
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": false,
  "createdAt": "2026-08-29T12:00:00.000Z",
  "updatedAt": "2026-08-29T12:00:00.000Z"
}
```

Enquanto `template_id` for nulo, `templateId` e `template` podem ser nulos no primeiro read compatível; `color`/`icon` continuam presentes. A reconciliação deve reduzir esse estado a zero antes do contract.

Durante `DB-COMPAT-002`, o token institucional novo nunca é gravado diretamente em `accounts.color`. Uma projeção central converte os dez tokens institucionais para o enum reconhecido pela v0.3: Nubank→`purple`, Inter→`orange`, Itaú→`blue`, Bradesco/Santander→`red`, Banco do Brasil→`yellow`, Caixa→`sky`, C6→`zinc`, PicPay→`green` e Mercado Pago→`blue`. `account_templates.color_token` preserva o token institucional original.

## Ownership E Segurança

- `userId` sempre vem de `@CurrentUser()`.
- Seleção de template customizado usa `id + owner_user_id` no predicado de acesso.
- Institucional só é selecionável quando `is_active=true`.
- Rendering de template já associado não usa a regra de seleção e permite institucional inativo.
- Tentativa de usar custom de outro usuário retorna not found.
- O comando de curadoria aceita download somente da origem HTTPS e do prefixo versionado definidos na allowlist, sem URL arbitrária fornecida por usuário.
- O comando valida destino no bucket público configurado e não aceita bucket vindo de input de usuário.
- URLs públicas são construídas pelo adapter interno de Object Storage.

## Seed E Catálogo Versionado

Adicionar um catálogo somente leitura, por exemplo:

```text
api/src/modules/accounts/infrastructure/catalog/institutional-account-templates.catalog.ts
```

Cada entrada contém ID UUID estável, `catalogKey`, nome, código, ISPB, `sourceLogoUrl`, checksums de origem/publicação, token e storage key. A URL externa é usada apenas pelo comando de curadoria.

Adicionar scripts npm explícitos:

```text
account-templates:curate
account-templates:seed
account-templates:reconcile
```

O seed usa upsert por `catalog_key`, em transação, e atualiza somente campos curados. Ele não consulta rede, não faz upload e não remove automaticamente registros ausentes do catálogo.

## Curadoria De Dados E Logos

Fluxo do comando:

```text
BrasilAPI v1 (`logo_url`)
  -> download HTTPS do SVG em origem allowlisted
  -> validação estrutural e de integridade
  -> bytes SVG curados
  -> putObject no bucket público configurado
  -> HEAD/checksum do objeto
  -> catálogo candidato para revisão
  -> commit do catálogo versionado
  -> seed explícito
```

Origem permitida para os SVGs:

```text
https://cdn.jsdelivr.net/npm/logos-bancos-br@0/logos/svg/<ispb>.svg
```

O comando confere a resposta atual da BrasilAPI contra `sourceLogoUrl` versionada. Mudança de URL não é seguida automaticamente: ela gera divergência para revisão. O SVG deve ter status `200`, tamanho limitado, content type compatível, raiz SVG válida e checksum SHA-256 idêntico ao manifesto curado. Antes do upload, o validador rejeita DTD/entities, `script`, `foreignObject`, atributos `on*` e referências externas executáveis. Os mesmos bytes aprovados são publicados com `Content-Type: image/svg+xml`; qualquer divergência posterior exige aprovação explícita antes de sobrescrever o asset.

Storage key canônica:

```text
banking-institutions-icons/<catalog-key>.svg
```

O exemplo `account-templates/nubank.*` não é usado como prefixo final; a decisão explícita do diretório `banking-institutions-icons` prevalece.

## Rollout Expand -> Migrate -> Contract

### Code N E N+1

- Code N: v0.3, conhece somente `accounts.color`/`icon` e o contrato HTTP legado.
- Code N+1: primeira imagem da feature, conhece templates e mantém compatibilidade legada.

### Matriz

| Combinação                | Compatível? | Motivo/ordem                                             |
| ------------------------- | ----------- | -------------------------------------------------------- |
| code N antes da expand    | sim         | baseline v0.3.                                           |
| code N depois da expand   | sim         | colunas antigas permanecem; `template_id` é nullable.    |
| code N+1 antes da expand  | não         | entidades/repositories dependem da nova tabela e coluna. |
| code N+1 depois da expand | sim         | schema novo existe e fallback atende linhas legadas.     |

### Ordem De Deploy

1. Conferir os dez registros e `logo_url` da BrasilAPI, validar os SVGs e fazer upload dos assets curados.
2. Executar migration expand: criar `account_templates`, adicionar `accounts.template_id` nullable, constraints e índices.
3. Executar o seed institucional explícito usando a imagem N+1 como comando one-off, enquanto a imagem N ainda pode continuar ativa.
4. Ativar code N+1 com dual-read, dual-write e payload legado.
5. Executar reconciliação em lotes para `template_id IS NULL`.
6. Reexecutar reconciliação enquanto a v0.3 continuar elegível, inclusive depois de qualquer rollback.
7. Observar nulidade, divergência legada e uso de payload legado.
8. Na v0.5, depois do gate, criar migration contract separada.

### Rollback Da Aplicação

Rollback de N+1 para N não reverte migration. A v0.3 continua usando `color`/`icon`, ignora tabela/coluna novas e cria linhas com `template_id=NULL`. Quando N+1 voltar, fallback e reconciliação absorvem essas linhas.

### Backfill/Reconciliation

O volume deve ser medido antes da execução:

```sql
SELECT count(*) FROM accounts WHERE template_id IS NULL;
```

O comando processa lotes configuráveis. Cada account usa transação curta com lock e recheck de `template_id IS NULL`; criação do template customizado e update da account são atômicos. O processo registra contagem, falhas sanitizadas e checkpoint, sem dados financeiros ou segredo.

Não criar um template por combinação global de cor/ícone: isso poderia compartilhar customização entre usuários. A migração preserva isolamento criando template privado por account legada.

### Contrato `DB-COMPAT-002`

Na implementação da expand, registrar `DB-COMPAT-002` em `docs/architecture/compatibility.md` como `EXPAND_ACTIVE`.

Gate objetivo para `READY_TO_CONTRACT`:

- v0.3 e qualquer imagem que omita `template_id` não são mais rollback possível;
- `SELECT count(*) FROM accounts WHERE template_id IS NULL` retorna zero após a janela definida;
- telemetria não observa payloads `color`/`icon` legados durante a janela acordada;
- não há divergência entre template e shim legado;
- API e frontend ativos usam o request `template` e o response `templateId`/`template`;
- rollback elegível mínimo já entende templates.

Contract exato, em migration/release posterior:

- `SET NOT NULL` em `accounts.template_id`;
- remover `accounts.color` e `accounts.icon`;
- remover dual-read, dual-write e reconciliação legada;
- remover `color`/`icon` dos request/response DTOs e do cache;
- remover validações e constantes exclusivas do contrato legado quando não houver outro consumidor;
- atualizar Swagger, docs de integração, `docs/database/schema.md` e marcar `DB-COMPAT-002` como `RETIRED`.

## Erros

Usar `platform-errors` durante a implementação. Erros de domínio/aplicação permanecem independentes de HTTP e são traduzidos pelo filtro global.

Casos públicos necessários:

- template institucional não encontrado/não selecionável ou referência para um template de outro tipo;
- combinação de `template` com campos legados;
- token customizado inválido;
- template institucional imutável;
- falha operacional de seed/curadoria deve encerrar comando com exit code não zero, não virar erro HTTP.

## Testes

### Domain

- criação/reconstituição de institucional e custom;
- invariantes de owner, metadados, token e storage key;
- account altera somente `templateId` como estado visual novo.

### Application

- seleção institucional ativa;
- bloqueio de institucional inativa;
- bloqueio de custom de outro usuário;
- create/update institucional, customizado e legado;
- rejeição de `type=institutional` apontando para template persistido customizado;
- confirmação de que `type=custom` nunca é copiado diretamente para persistência e não aceita owner/metadados institucionais;
- rejeição de payload misto;
- atomicidade entre template e account;
- leitura/rendering de institucional inativa já associada;
- detecção de divergência causada por writer v0.3;
- reconciliação idempotente.

### Infrastructure/PostgreSQL Real

- migration `up/down/up`;
- constraints e índices planejados;
- FK `ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`;
- code N equivalente após expand;
- code N+1 no schema expandido;
- seed repetido sem duplicação;
- locks e idempotência do reconciler.

### E2E

- catálogo autenticado;
- create/update com request `template` discriminado e list com `templateId`/`template` no response;
- payload legado v0.3;
- response aditivo com campos deprecated;
- isolamento de template customizado;
- template inativo fora do catálogo e ainda renderizado em account associada.

### Performance

- validar listagem sem N+1 queries;
- usar `EXPLAIN (ANALYZE, BUFFERS)` nas queries de catálogo/ownership e join/batch de templates com volume representativo;
- confirmar uso de `idx_accounts_template_id` e `idx_account_templates_owner_user_id` quando aplicável.

## Impacto De Documentação

Na implementação:

- atualizar `docs/database/schema.md` com o estado expand realmente implantado, mantendo `color`/`icon` e documentando `template_id` nullable;
- registrar `DB-COMPAT-002` em `docs/architecture/compatibility.md`;
- atualizar conceitos, invariantes, fluxos e decisões em `docs/accounts/**`;
- criar/atualizar contratos em `docs/integrations/accounts/**`;
- atualizar Swagger e discriminadores centralizados;
- registrar versão/release real da expansão quando conhecida.

`docs/database/schema.md` não deve antecipar uma migration ainda não aplicada; sua atualização ocorre no mesmo change set da migration expand.

## Riscos E Mitigações

| Risco                                   | Mitigação                                                                                                                                           |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rollback para v0.3 perde escrita        | manter colunas e dual-write; nullable + fallback/reconciliação.                                                                                     |
| Cross-tenant em custom template         | criação pelo user autenticado, rendering por `id + owner_user_id` e testes de isolamento.                                                           |
| N+1 queries ao listar accounts          | carregamento batch por IDs.                                                                                                                         |
| URL/arquivo incorreto tratado como logo | comparação com catálogo, allowlist estrita, checksum e validação estrutural do SVG.                                                                 |
| Segredo em log/catálogo                 | configuração server-side e redaction.                                                                                                               |
| Remoção de template em uso              | FK deferred `NO ACTION`; desativação lógica. O defer permite que a exclusão de usuário remova accounts e templates customizados na mesma transação. |
| Catálogo muda de forma não auditada     | dados e IDs versionados; seed explícito.                                                                                                            |
| Cache atravessa rollback                | payload aditivo com campos antigos preservados e novos opcionais.                                                                                   |

Antes do SQL final, registrar também o lock esperado para adicionar a coluna/FK e criar o índice em `accounts`. Volume ou janela operacional desconhecidos impedem escolher silenciosamente entre índice transacional e `CONCURRENTLY`.

## Validação Pré-Implementação

Este desenho requer aprovação explícita antes do código, principalmente para:

- schema proposto de `account_templates`;
- semântica de templates customizados privados por account legada;
- endpoint `GET /account-templates`;
- precedência do prefixo `banking-institutions-icons/`;
- comportamento de desativação;
- gates do contract da v0.5.
