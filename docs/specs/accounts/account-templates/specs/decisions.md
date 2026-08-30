---
area: accounts
feature: account-templates
type: spec-decisions
status: approved
issue: 91
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Account Templates

## DEC-001 - Account referencia template em vez de possuir identidade visual

Status: accepted

Decision:
A identidade visual nova de uma account é representada por `account.templateId`. `color` e `icon` permanecem somente como shim temporário.

Reason:
Separa dado financeiro de apresentação e permite reutilizar identidades institucionais.

Impact:
O contract futuro remove os campos visuais da account, mas não durante a janela de rollback da v0.3.

## DEC-002 - Persistir tipo e ownership do template

Status: accepted

Decision:
`account_templates.template_type` diferencia `INSTITUTIONAL` de `CUSTOM`; `owner_user_id` é nulo para institucional e obrigatório para custom.

Reason:
O modelo precisa distinguir catálogo global imutável de personalização privada e aplicar tenant isolation sem copiar instituições por usuário.

Impact:
Uma constraint protege a coerência tipo/owner e a aplicação filtra custom por usuário autenticado.

## DEC-003 - Templates institucionais guardam logo; customizados guardam icon key

Status: accepted

Decision:
Institucionais usam `logo_storage_key`; customizados preservam `icon_key`. Ambos usam `color_token`, que pode ser nulo apenas para custom.

Reason:
Isso representa o catálogo institucional e preserva accounts legadas sem forçar o módulo `assets` ou upload customizado nesta entrega.

Impact:
O response usa `logoUrl` ou `iconKey`; o bucket e a key nunca são expostos.

## DEC-004 - Tokens institucionais têm o nome estável da instituição

Status: accepted

Decision:
Os dez tokens iniciais são `nubank`, `inter`, `itau`, `bradesco`, `santander`, `banco-do-brasil`, `caixa`, `c6`, `picpay` e `mercado-pago`.

Reason:
O backend identifica a intenção visual; o frontend decide a cor concreta no design system.

Impact:
Não há hex nem classe CSS no banco. A allowlist é própria de account templates e não altera os tokens genéricos de categories.

## DEC-005 - BrasilAPI é a única fonte externa da curadoria inicial

Status: accepted

Decision:
Runtime e seed não consultam fornecedores externos. Um comando explícito confere os registros e `logo_url` da BrasilAPI, baixa os SVGs da origem allowlisted, valida integridade/markup e faz upload dos logos vetoriais; o seed usa o catálogo commitado.

Reason:
Disponibilidade e latência de terceiros não podem afetar leitura/criação cotidiana de accounts.

Impact:
O pipeline possui dois passos separados: curadoria com rede e seed determinístico sem rede.

## DEC-006 - Prefixo canônico dos logos é banking-institutions-icons

Status: accepted

Decision:
Usar `banking-institutions-icons/<catalog-key>.svg` no bucket público configurado.

Reason:
Esse foi o diretório explicitamente definido para os assets institucionais. O exemplo posterior `account-templates/nubank.*` foi tratado como ilustração do fluxo, não como override do prefixo.

Impact:
`logo_storage_key` contém somente a key relativa e o ambiente resolve `danfy-public-bucket`/URL.

## DEC-007 - Não usar a tabela assets

Status: accepted

Decision:
Logos institucionais não criam registros em `assets`.

Reason:
`assets` modela arquivos pertencentes a usuários e seu lifecycle; logos globais têm ownership e lifecycle diferentes.

Impact:
`account_templates` referencia diretamente a storage key sob controle da Danfy.

## DEC-008 - Desativação bloqueia novas escolhas sem quebrar contas existentes

Status: accepted

Decision:
`is_active=false` remove o institucional do catálogo selecionável, mas responses de accounts já associadas continuam renderizando o template.

Reason:
Remover ou ocultar os metadados de uma referência existente quebraria contas de todos os usuários vinculados.

Impact:
Há métodos distintos para seleção e rendering; a FK deferred usa `ON DELETE NO ACTION`, bloqueando remoção de template ainda referenciado sem impedir a exclusão transacional de um usuário com suas accounts e seus templates customizados.

## DEC-009 - Expand mantém v0.3; contract fica para v0.5

Status: accepted

Decision:
Adicionar tabela e `template_id` nullable, manter `color`/`icon`, operar dual-read/dual-write e adiar `NOT NULL`/`DROP` até a v0.5 após a v0.3 deixar a janela de rollback.

Reason:
Migrations rodam antes da imagem e não são revertidas automaticamente no rollback.

Impact:
A implementação registra `DB-COMPAT-002`; a limpeza exige nova migration e evidência do gate.

## DEC-010 - Objeto template novo e payload legado são mutuamente exclusivos

Status: accepted

Decision:
Aceitar `template` ou `color`/`icon`, nunca ambos no mesmo request. O objeto novo é discriminado por `type`: `institutional` recebe `templateId`; `custom` recebe `colorToken`/`iconKey`.

Reason:
Evita duas fontes conflitantes de identidade visual e mantém requests v0.3 válidos.

Impact:
Payload misto retorna erro de validação antes de qualquer escrita. O `templateId` deixa de existir na raiz dos DTOs de create/update antes da primeira release da feature.

## DEC-011 - Backfill cria template privado por account legada

Status: accepted

Decision:
Cada account sem template recebe um template `CUSTOM` próprio em reconciliação transacional e idempotente.

Reason:
Compartilhar por combinação de cor/ícone poderia acoplar usuários ou fazer uma alteração futura afetar accounts não relacionadas.

Impact:
O número inicial de templates customizados pode se aproximar do número de accounts legadas; o volume será medido e processado em lotes.

## DEC-012 - Não cachear o catálogo na primeira versão

Status: accepted

Decision:
Consultar templates no PostgreSQL, com batch na listagem, sem cache dedicado.

Reason:
O catálogo inicial é pequeno e cache adicionaria invalidação à desativação/curadoria sem evidência de necessidade.

Impact:
Performance será comprovada com query count e `EXPLAIN`; cache pode ser avaliado depois.

## DEC-013 - Discriminador HTTP não define o tipo persistido

Status: accepted

Decision:
`template.type` seleciona o branch do comando, mas o backend mantém soberania sobre `account_templates.template_type`. O branch institucional consulta uma referência existente e confirma que seu tipo persistido é institucional; o branch customizado cria ou atualiza o template somente por factories e comportamentos de domínio próprios.

Reason:
Aceitar a classificação enviada pelo cliente como estado persistido permitiria forjar ownership, transformar template customizado em institucional ou associar recursos por um fluxo incorreto.

Impact:
O input de aplicação é uma união discriminada, não uma cópia de `AccountTemplateProps`. `ownerUserId`, `catalogKey`, `logoStorageKey`, dados bancários e `isActive` nunca vêm do request de account.

## DEC-014 - Account e AccountTemplate são aggregate roots separados

Status: accepted

Decision:
`Account` e `AccountTemplate` tornam seus papéis de aggregate root explícitos no domínio. `Account` referencia o outro aggregate somente por `templateId`; não contém nem persiste o grafo de template em cascata.

Reason:
Templates institucionais são globais, compartilhados e têm lifecycle independente. Essa fronteira difere de `User/AuthProvider`, em que o provider pertence exclusivamente ao aggregate `User`.

Impact:
Casos de uso coordenam os dois repositories. Quando create/update precisa modificar ambos, a transação da aplicação garante atomicidade e o response combina os aggregates sem alterar a fronteira de ownership.
