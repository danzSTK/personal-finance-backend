---
area: accounts
type: decision
status: draft
related:
  - ../flows/delete-account.md
  - ../flows/archive-account.md
---

# Delete Apenas Sem Movimento

## Decisão

Permitir delete de account somente se ela nunca teve movimentação ou vínculo financeiro.

## Motivos

- Corrigir criação acidental continua simples.
- Histórico financeiro permanece íntegro.
- Arquivamento substitui delete quando há histórico.

## Regra

Qualquer transação, agendamento, transferência ou vínculo financeiro torna delete indisponível.
