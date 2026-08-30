---
area: accounts
type: decision
status: accepted
issue: 91
related:
  - ../../specs/accounts/account-templates/specs/requirements.md
  - ./institutional-template-assets-use-controlled-storage.md
---

# Catálogo Institucional De Account Templates É Curado

## Decisão

Provisionar templates institucionais por seed explícito, idempotente e determinístico a partir de um catálogo versionado pela Danfy.

BrasilAPI v1 é a fonte de referência para dados bancários e para a `logo_url` de cada instituição. A origem externa não é consultada pelo seed, pelo startup ou por requests normais da aplicação.

Fluxo:

```text
BrasilAPI v1 (`logo_url`)
  -> curadoria explícita da Danfy
  -> catálogo e assets controlados
  -> seed idempotente
  -> account_templates globais
```

## Catálogo Inicial

- Nubank
- Inter
- Itaú
- Bradesco
- Santander
- Banco do Brasil
- Caixa
- C6 Bank
- PicPay
- Mercado Pago

Os identificadores, source logo URLs, tokens e storage keys exatos ficam no catálogo versionado e na spec da issue #91.

## Motivos

- O catálogo não muda por resposta externa sem revisão.
- Reexecução do seed converge sem duplicação.
- Deploy e leitura de accounts não dependem da disponibilidade de terceiros.
- Atualizações institucionais permanecem auditáveis em revisão de código.

## Consequências

- Curadoria e seed são comandos diferentes.
- O seed não roda em migration nem no startup normal.
- Sincronização automática fica fora de escopo.
- Inclusão, alteração, desativação ou remoção futura exige decisão consciente e versionada.
