---
area: accounts
type: flow
status: current
endpoint: POST /accounts
related:
  - ../concepts/account.md
  - ../concepts/account-type.md
  - ../../integrations/accounts/create-account.md
---

# Create Account

Cria uma account para o usuário autenticado.

## Fluxo Atual

1. Controller recebe `CreateAccountDto`.
2. `userId` vem de `@CurrentUser()`.
3. Use case verifica se o usuário já possui default account.
4. Se a nova account deve ser default, remove o default anterior.
5. Factory cria a entidade de domínio.
6. Repositório persiste a account.
7. Controller retorna `AccountResponseDto`.

## Observação V0

A criação manual de `CASH` será bloqueada quando o fluxo de onboarding criar a CASH estrutural do usuário.
