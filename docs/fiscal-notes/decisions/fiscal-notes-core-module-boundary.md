---
area: fiscal-notes
type: decision
status: current
related:
  - ../flows/import-link-and-lifecycle.md
  - ../../architecture/module-boundaries.md
---

# Desacoplamento Acíclico entre `fiscal-notes` e `transactions` via `FiscalNotesCoreModule`

## Decisão

Dividir o módulo em dois módulos NestJS com responsabilidades distintas e comunicação exclusiva por portas públicas de aplicação:

1. **`FiscalNotesCoreModule`:** Sem dependência de `TransactionsModule`. Encapsula as entidades ORM (`FiscalNoteOrmEntity`, `FiscalNoteItemOrmEntity`, `FiscalNotePaymentOrmEntity`), `IFiscalNoteRepository` (`FiscalNoteRepository`) e exporta `FiscalNoteTransactionLifecyclePort` (`FiscalNoteTransactionLifecycleAdapter`).
2. **`TransactionsModule`:** Importa `FiscalNotesCoreModule` (consumindo `FiscalNoteTransactionLifecyclePort` para popular `hasFiscalNote`, bloquear mudança de `type` e executar soft delete sincronizado) e exporta `TransactionFiscalNotePort` (`TransactionFiscalNoteAdapter`).
3. **`FiscalNotesModule`:** Importa `FiscalNotesCoreModule`, `TransactionsModule` e `CircuitBreakerModule`, orquestrando controllers, casos de uso, cache Redis, rate limiter e provedores SEFAZ.

## Motivos

1. **Eliminação de Ciclo de Dependências:** `TransactionsModule` precisa consultar e soft-deletar notas fiscais no mesmo fluxo transacional das transações, enquanto `FiscalNotesModule` precisa criar e bloquear transações `EXPENSE` ao importar ou vincular notas. A extração de `FiscalNotesCoreModule` (seguindo o padrão consolidado de `AssetsCoreModule`) torna o grafo estritamente acíclico (`FiscalNotesModule -> TransactionsModule -> FiscalNotesCoreModule`) sem recorrer a `forwardRef()`.
2. **Preservação de Limites entre Módulos:** Nenhum repositório ou use case de `transactions` acessa diretamente `FiscalNoteOrmEntity` ou `FiscalNoteRepository`, e `fiscal-notes` nunca instancia `TransactionFactory` nem manipula `TransactionOrmEntity` diretamente — toda mutação em `transactions` passa por `TransactionFiscalNotePort`.
3. **Atomicidade Imediata no Soft Delete:**
   - *Alternativa descartada — Eventos assíncronos (Outbox) para remover a nota ao excluir uma transação:* deixaria uma janela temporal em que a `access_key` continuaria bloqueada para reimportação e a nota pareceria ativa mesmo após a exclusão da transação. Com `FiscalNoteTransactionLifecyclePort.softDeleteByTransactionId` recebendo `{ manager }`, ambas as tabelas são atualizadas na mesma transação PostgreSQL.
   - *Alternativa descartada — Embutir `fiscal-notes` dentro de `transactions`:* acoplaria lógica de parsing HTML, anti-SSRF, Circuit Breaker e provedores por UF ao núcleo financeiro.

## Trade-offs e Riscos Aceitos

- **Dois Módulos NestJS para um Mesmo Domínio:** Exige disciplina ao adicionar novos providers em `fiscal-notes` (persistência e ciclo de vida compartilhado ficam em `FiscalNotesCoreModule`; orquestração HTTP, cache e provedores externos ficam em `FiscalNotesModule`).
  - *Mitigação:* Fronteira documentada no `AGENTS.md` local do módulo e em `docs/architecture/module-boundaries.md`.
