---
area: fiscal-notes
type: concept
status: current
related:
  - ./input-and-provider-strategy.md
  - ../flows/import-link-and-lifecycle.md
  - ../decisions/html-scraping-sefaz-ce-without-raw-storage.md
  - ../../database/schema.md
---

# Fiscal Note Aggregate

`FiscalNote` é a raiz de agregado que representa os dados fiscais estruturados de uma **NFC-e** (modelo `65`) importada ou vinculada pelo usuário, composta por sua lista ordenada de itens (`FiscalNoteItem`) e meios de pagamento (`FiscalNotePayment`).

O agregado existe como uma abstração separada de `Transaction` para isolar metadados fiscais, cabeçalho do estabelecimento emissor, granularidade de produtos e formas de pagamento sem poluir o modelo financeiro central (`accounts` / `transactions`) com regras de parsing tributário ou múltiplos sub-recursos.

`FiscalNote` **não** substitui a transação financeira no cálculo de saldo das contas, **não** armazena documentos brutos (HTML ou XML) e **não** contém dados pessoais do comprador/consumidor.

## Identidade, Ownership e Multi-Tenancy

- **Identidade:** `id` (`uuid` gerado pela aplicação/banco).
- **Ownership:** `userId` (`uuid` obrigatório referenciando `users.id` com `ON DELETE RESTRICT`), garantindo isolamento estrito por tenant em todas as leituras e mutações (incluindo listagem `GET /fiscal-notes` filtrada por `userId` e detalhe direto `GET /fiscal-notes/:id` filtrado por `(id, userId)`).
- **Unicidade por Usuário e Chave (`UQ_fiscal_notes_user_access_key_active`):** Um usuário não pode manter duas notas **ativas** (`deleted_at IS NULL`) com a mesma `access_key` de 44 dígitos. Usuários distintos podem importar e vincular a mesma `access_key` de forma independente.
- **Unicidade por Transação (`UQ_fiscal_notes_transaction_active`):** Uma `Transaction` pode possuir no máximo uma `FiscalNote` **ativa** por vez (`deleted_at IS NULL`).
- **Ciclo de Vida e Soft Delete:** A remoção ocorre via `deleted_at` (seja pelo desvínculo explícito ou sincronizada na exclusão da transação). Após o soft delete, tanto a `access_key` quanto a `transaction_id` ficam imediatamente livres para nova importação ou vínculo, preservando o registro histórico inativo.

### Índices de `fiscal_notes` e Padrão de Consulta Leve

- `UQ_fiscal_notes_user_access_key_active`: índice único parcial em `(user_id, access_key) WHERE deleted_at IS NULL`.
- `UQ_fiscal_notes_transaction_active`: índice único parcial em `(transaction_id) WHERE deleted_at IS NULL`.
- `idx_fiscal_notes_user_id`: índice em `(user_id)` (não parcial; cobre a FK `FK_fiscal_notes_user` inclusive em registros soft-deletados).
- `idx_fiscal_notes_user_issued_at_active`: índice composto parcial em `(user_id, issued_at DESC) WHERE deleted_at IS NULL`, projetado para a listagem paginada `GET /fiscal-notes` ordenada por emissão decrescente e filtros de período em `issued_at`.
- `idx_fiscal_notes_transaction_id`: índice em `(transaction_id)` (não parcial; cobre lookups da FK `FK_fiscal_notes_transaction`).
- **Resumo Leve vs. Agregado Completo:** Na listagem paginada (`GET /fiscal-notes`), o módulo projeta um resumo leve (`fiscal_note.summary`) com `itemsCount` sem hidratar arrays de `FiscalNoteItem` e `FiscalNotePayment`, evitando bloat de payload e multiplicação de linhas; buscas textuais por descrição de item usam subconsulta `EXISTS` para preservar paginação e totais agregados exatos. O agregado completo (`items` e `payments`) é carregado apenas nas consultas individuais (`GET /fiscal-notes/:id` e `GET /transactions/:id/fiscal-note`).

## Privacidade (LGPD e Zero-PII)

A política de privacidade do agregado proíbe a persistência e a exposição de dados pessoais do consumidor final:

1. **Descarte na Origem:** O parser remove explicitamente qualquer seção colapsável de `Consumidor` (CPF/CNPJ, nome e endereço do comprador) antes de extrair e validar os demais campos da nota.
2. **Sem HTML/XML Bruto:** Apenas os campos estruturados e sanitizados são gravados no PostgreSQL e no cache Redis; HTML bruto jamais é persistido em banco, cache, object storage ou logs.
3. **Chaves Mascaradas em Logs:** Logs estruturados e alertas operacionais nunca registram payloads completos de QR Code (que carregam `cscId` e `qrHash`), CNPJs crus ou chaves completas; quando necessário para diagnóstico, usam `maskAccessKeyForLog` no formato `<UF>***<últimos 4 dígitos>` (ex.: `23***8780`).

## Precisão Financeira, Quantidades e Datas

- **Valores Monetários em Centavos (`bigint`):** Todos os valores financeiros do agregado — `grossAmountCents`, `discountAmountCents`, `payableAmountCents`, `taxAmountCents`, `changeAmountCents` (cabeçalho), `totalPriceCents` (`FiscalNoteItem`) e `amountCents` (`FiscalNotePayment`) — são inteiros seguros não negativos persistidos como `bigint` no PostgreSQL.
- **Troco Ausente (`NaN` da SEFAZ):** A SEFAZ-CE pode retornar literalmente `"NaN"` no campo de troco; o parser converte `"NaN"` ou ausência do campo para `changeAmountCents = null`.
- **Tolerância Aritmética de Cabeçalho:** O domínio e o parser exigem coerência entre bruto, desconto e líquido dentro da tolerância de 1 centavo (`|((grossAmountCents - discountAmountCents) - payableAmountCents)| <= 1`) para acomodar arredondamentos fiscais do emissor.
- **Quantidades e Preço Unitário (`numeric(12, 4)`):** Itens pesáveis ou fracionados (ex.: `0.468 kg` a `R$ 26,99/kg`) exigem precisão decimal que não cabe em centavos inteiros. Por isso, `quantity` (`> 0`) e `unitPrice` (`>= 0`) são persistidos como `numeric(12, 4)` no PostgreSQL e validados como números finitos no domínio.
- **Data Civil (`DateOnly`) vs Instante (`Instant`):**
  - `issuedAt` é persistido em `timestamptz` como instante UTC exato (aplicando offset `-03:00` / `America/Fortaleza` quando o texto da SEFAZ-CE omitir timezone).
  - `issuedDate` (usada como `suggestedTransaction.date` na pré-visualização e na criação da despesa) é extraída diretamente da data civil local (`YYYY-MM-DD`) exibida na emissão, evitando que compras noturnas após 21h00 no Ceará avancem para o dia seguinte em UTC.

## Relação com Outros Conceitos

- **`transactions` (`Transaction`):** A associação é exclusiva para transações do tipo `EXPENSE`. A tabela `fiscal_notes` referencia `transactions(id)` com `ON DELETE RESTRICT`, e o módulo `transactions` expõe apenas o indicador booleano leve `hasFiscalNote` via porta `FiscalNoteTransactionLifecyclePort`, sem embutir itens ou pagamentos na listagem de transações.
- **Independência da Despesa:** A `FiscalNote` funciona como evidência detalhada da compra. O valor real que impacta o saldo da conta continua sendo `transactions.amount_cents`, que pode diferir de `payableAmountCents` quando o usuário informa overrides no `import` ou vincula a nota a uma despesa preexistente.
