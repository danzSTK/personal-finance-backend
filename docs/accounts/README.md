---
area: accounts
type: index
status: current
---

# Accounts

Este diretório documenta as regras de negócio, decisões arquiteturais e fluxos internos do domínio de contas.

Para documentação de consumo HTTP, use [Accounts integration](../integrations/accounts/README.md).

## Canvas

- [Accounts canvas](./accounts.canvas)
- [Events flow](../Excalidraw/Events-flow.excalidraw.md)
- [Events architecture](../events/README.md)
- [Events map](../events/events-map.canvas)

## Mapa

### Conceitos

- [Account](./concepts/account.md)
- [Account template](./concepts/account-template.md)
- [Account type](./concepts/account-type.md)
- [CASH account](./concepts/cash-account.md)
- [Default account](./concepts/default-account.md)
- [Account balance](./concepts/account-balance.md)
- [Archived account](./concepts/archived-account.md)

### Fluxos

- [Create account](./flows/create-account.md)
- [Update account](./flows/update-account.md)
- [Archive account](./flows/archive-account.md)
- [Unarchive account](./flows/unarchive-account.md)
- [Set default account](./flows/set-default-account.md)
- [Delete account](./flows/delete-account.md)
- [Onboarding CASH account](./flows/onboarding-cash-account.md)
- [Transfer between accounts](./flows/transfer-between-accounts.md)

### Decisões

- [CASH account created on onboarding](./decisions/cash-account-created-on-onboarding.md)
- [One CASH account per user](./decisions/one-cash-account-per-user.md)
- [Account balance is derived](./decisions/account-balance-is-derived.md)
- [Delete only without movement](./decisions/delete-only-without-movement.md)
- [Transfers are neutral](./decisions/transfers-are-neutral.md)
- [Account visual identity uses templates](./decisions/account-visual-identity-uses-templates.md)
- [Account and account template are separate aggregates](./decisions/account-and-template-are-separate-aggregates.md)
- [Institutional account template catalog is curated](./decisions/institutional-account-template-catalog-is-curated.md)
- [Institutional template assets use controlled storage](./decisions/institutional-template-assets-use-controlled-storage.md)
- [Account template rollout preserves V0.3](./decisions/account-template-rollout-preserves-v0-3.md)

### Referência

- [Endpoints](./reference/endpoints.md)
- [Account types](./reference/account-types.md)
- [Invariants](./reference/invariants.md)
- [Open questions](./reference/open-questions.md)
- [Account template catalog operations](./reference/account-template-catalog-operations.md)
