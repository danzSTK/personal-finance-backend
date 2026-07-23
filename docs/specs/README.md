---
area: specifications
type: index
status: current
last_reviewed: 2026-07-23
---

# Especificações técnicas

As specs registram requisitos, desenho, tarefas e decisões de mudanças relevantes antes e durante sua implementação.

## Estrutura

```text
<contexto>/<feature>/specs/
├── requirements.md
├── design.md
├── tasks.md
└── decisions.md
```

- `requirements.md`: comportamento esperado, casos limite e critérios de aceite;
- `design.md`: arquitetura, componentes, dependências e fluxo de dados;
- `tasks.md`: decomposição e estado da implementação;
- `decisions.md`: escolhas técnicas, alternativas e impactos.

## Accounts

- [Account summary](./accounts/account-summary/specs/requirements.md)
- [Balance summary](./accounts/balance-summary/specs/requirements.md)

## Auth

- [Email verification](./auth/email-verification/specs/requirements.md)

## Notifications

- [Welcome email](./notifications/welcome-email/specs/requirements.md)

## Platform

- [Separação entre API e worker](./platform/api-worker-separation/specs/requirements.md)
- [Backend CI](./platform/backend-ci/specs/requirements.md)
- [Atualizações de dependências](./platform/dependency-updates/specs/requirements.md)
- [Publicação de containers](./platform/container-publication/specs/requirements.md)
- [Email provider](./platform/email-provider/specs/requirements.md)
- [Deploy de produção](./platform/production-deploy/specs/requirements.md)
- [Infraestrutura de filas](./platform/queue-infrastructure/specs/requirements.md)
- [Automação de releases](./platform/release-automation/specs/requirements.md)
- [Objetos de resposta](./platform/response-objects/specs/requirements.md)

## Transactions

- [Core de transações](./transactions/core/specs/requirements.md)
- [Filtros, paginação e resumo](./transactions/list-filters-summary/specs/requirements.md)

## Users

- [Alteração de username](./users/change-username/specs/requirements.md)

## Processo de manutenção

1. altere requisitos quando uma regra de negócio mudar;
2. altere design quando a solução técnica mudar;
3. altere tasks quando o escopo ou a ordem do trabalho mudar;
4. registre em decisions escolhas e trade-offs relevantes;
5. mantenha a documentação operacional alinhada ao comportamento já implementado.
