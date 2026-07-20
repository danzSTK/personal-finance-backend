# Hoje - 19/07/2026

## Feito

- Finalizada a bateria de testes da separacao entre API e worker.
- Corrigidos os cinco apontamentos da revisao da PR:
  - inicializacao do outbox somente depois do bootstrap completo do worker;
  - falha explicita quando um evento do outbox nao possui listener;
  - remocao do fallback entre as configuracoes do BullMQ e do cache Redis;
  - ajuste das configuracoes do BullMQ no Docker Compose;
  - remocao do scheduler e correcao dos imports de bootstrap.
- Validacoes executadas com sucesso: build, lint, formatacao, 188 testes
  unitarios, 22 testes de integracao e 1 teste E2E.
- Alteracoes publicadas na `develop` no commit `aa15c30`.
- PR #40 aberta para a `main`:
  <https://github.com/danzSTK/personal-finance-backend/pull/40>
- Tratada a rejeicao da busca do lote no reconciliador de e-mails, evitando
  Promise rejeitada sem tratamento no timer.
- Adicionados scripts separados para formatacao, lint e typecheck em modo de
  verificacao.
- `docs/.obsidian/workspace.json` removido do rastreamento e ignorado pelo Git.

## Pendente

- Corrigir os erros de tipagem preexistentes encontrados pelo novo comando de
  typecheck.
- Finalizar a PR #40 na `main`.
- Iniciar a especificacao de observabilidade para PostgreSQL, Redis, liveness e
  readiness da API e do worker.

## Retomar

```bash
git status --short
git log -3 --oneline
gh pr view 40
```

O proximo assunto arquitetural e a observabilidade dos recursos essenciais,
principalmente a deteccao e comunicacao da indisponibilidade do PostgreSQL.
