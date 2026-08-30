---
area: accounts
type: decision
status: accepted
issue: 91
related:
  - ../concepts/account.md
  - ../concepts/account-template.md
  - ../../specs/accounts/account-templates/specs/design.md
---

# Account E AccountTemplate São Aggregates Separados

## Decisão

`Account` e `AccountTemplate` possuem lifecycle próprio e são aggregate roots separados. `Account` referencia a identidade visual somente por `templateId`; não contém o template nem o persiste em cascata.

O objeto `template` recebido em `POST /accounts` e `PATCH /accounts/:id` é um comando de entrada. Ele não significa que `AccountTemplate` passou a ser uma entidade interna de `Account`.

## Motivos

- Templates institucionais são globais e compartilhados por muitas accounts.
- Seed, ativação, desativação e curadoria possuem lifecycle independente da account.
- Uma account não pode ser proprietária nem alterar em cascata um template institucional compartilhado.
- A fronteira difere de `User/AuthProvider`: cada provider pertence exclusivamente a um único user e é controlado pelo aggregate `User`.

## Consequências

- O caso de uso coordena `IAccountRepository` e `IAccountTemplateRepository`.
- Create/update que escrevem os dois aggregates usam uma transação da aplicação.
- O response pode combinar account e template como read model sem mudar ownership.
- O discriminador `template.type` escolhe um branch do comando, mas o tipo persistido é confirmado ou criado exclusivamente pelo backend.
