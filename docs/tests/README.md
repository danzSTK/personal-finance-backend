---
area: tests
type: reference
status: current
related:
  - ../platform/continuous-integration.md
  - ../specs/tests/e2e-integration-governance/specs/requirements.md
---

# Testes do backend

Este módulo documenta as suítes executadas fora dos testes unitários próximos ao
código. A fonte executável permanece em `api/test/`; estas páginas explicam
responsabilidade, limites e dependências operacionais.

## Categorias

| Categoria  | Padrão                             | Comando                    | Infraestrutura real |
| ---------- | ---------------------------------- | -------------------------- | ------------------- |
| Unitário   | `api/src/**/*.spec.ts`             | `npm test`                 | não                 |
| E2E        | `api/test/*.e2e-spec.ts`           | `npm run test:e2e`         | não atualmente      |
| Integração | `api/test/*.integration-spec.ts`   | `npm run test:integration` | conforme a suíte    |

Os comandos são executados a partir de `api/`. O comando agregado da categoria é
obrigatório antes de concluir uma mudança; filtros por arquivo servem apenas para
diagnóstico local.

## Catálogos

- [E2E](./e2e/README.md): bordas HTTP e contratos NestJS.
- [Integração](./integration/README.md): PostgreSQL, Redis, BullMQ, Toxiproxy,
  processos e componentes reais.

## Regra de manutenção

Ao criar, alterar, renomear ou remover uma suíte E2E ou de integração:

1. usar a skill `test-suite-governance`;
2. avaliar dependências locais e da CI antes de implementar;
3. comunicar antes de qualquer mudança necessária na pipeline;
4. atualizar a página da suíte e os índices na mesma entrega;
5. documentar dependência nova, disponibilidade, cleanup, timeout e segurança;
6. executar a suíte direcionada e depois o comando agregado.

Use [o template](./reference/suite-documentation-template.md) para novas páginas.

