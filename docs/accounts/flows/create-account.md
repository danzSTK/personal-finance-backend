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
3. Use case rejeita a combinação de `template` com `color`/`icon` legados.
4. Para `template.type=institutional`, consulta o ID e confirma que o template persistido é institucional e ativo.
5. Para `template.type=custom` ou payload legado, cria um template `CUSTOM` privado sem confiar em classificação persistida enviada pelo cliente.
6. Verifica se o usuário já possui default account e remove o default anterior quando necessário.
7. Persiste template, account e projeções legadas na mesma transação.
8. Controller retorna `AccountResponseDto` com o template associado.

## Observação V0

A criação manual de `CASH` será bloqueada quando o fluxo de onboarding criar a CASH estrutural do usuário.
