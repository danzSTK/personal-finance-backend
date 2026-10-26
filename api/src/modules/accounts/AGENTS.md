# Módulo Accounts — Instruções Locais

Este módulo gerencia contas financeiras e templates visuais de contas institucionais e personalizadas.

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/accounts/README.md` — Índice geral e mapa do módulo.
- `docs/accounts/concepts/account.md` e `account-template.md` — Modelo de agregados separados.
- `docs/accounts/decisions/` — Decisões de catálogo institucional e persistência.
- `docs/accounts/reference/invariants.md` — Invariantes de saldo inicial e moedas.

## Regras de Fronteira e Invariantes
- **Agregados separados:** `Account` e `AccountTemplate` são agregados distintos. Um não deve mutar diretamente a tabela do outro.
- **Isolamento de saldo:** O saldo atual é computado sob demanda a partir das transações ativas; contas não possuem coluna mutável de saldo em banco.
- **Limites:** Não chame diretamente repositórios de transações para mutações.
