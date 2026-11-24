@AGENTS.md

## Notas de Compatibilidade (Claude Code)

Este repositório mantém `AGENTS.md` (na raiz e em `api/src/modules/<modulo>/AGENTS.md`) e `.agents/skills/` como fonte única de verdade compartilhada entre **Codex** e **Claude Code**.

- **Instruções por módulo:** Antes de planejar, editar ou revisar arquivos dentro de `api/src/modules/<modulo>/`, leia o `AGENTS.md` daquele módulo (o Claude Code não carrega `AGENTS.md` aninhados automaticamente).
- **Skills compartilhadas:** `.claude/skills` aponta para `.agents/skills`. Use `/danfy-review`, `/security-review`, `/database-review`, `/migration-rollout`, `/platform-errors`, `/modular-documentation`, `/spec-driven-development` e demais skills conforme a tarefa.
- **Revisão de PR / diff:** Para revisão geral, aplique a skill `danfy-review` em conjunto com `## Code Review Rules` de `AGENTS.md`. Quando houver SQL/migrations/ORM entities, aplique também `database-review` e `migration-rollout`. Quando houver novas features, endpoints, auth, uploads, filas ou configuração, aplique também `security-review`.
