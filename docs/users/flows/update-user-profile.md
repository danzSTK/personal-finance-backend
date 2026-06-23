---
area: users
type: flow
status: current
---

# Update User Profile

## Entrada

`PATCH /users/me` recebe `firstName` e/ou `lastName`. O usuário é obtido da sessão autenticada, nunca do body.

## Fluxo

```text
UsersController
  -> UpdateUserProfileUseCase
  -> User.changerFirstName / User.changerLastName
  -> IUserRepository.save
  -> UserProfileResponseDto
```

## Regras

- Pelo menos um campo deve ser informado.
- Campo omitido não é alterado.
- `null` remove o valor atual.
- Strings são validadas pelo DTO e novamente pelo domínio.
- Espaços externos são removidos antes da persistência.
- `username` e `email` não pertencem a este fluxo.

## Erros

- `USER_UPDATE_INPUT_VOID`: nenhum campo editável foi enviado.
- `INVALID_USER`: nome viola tamanho mínimo/máximo do domínio.
- `VALIDATION_ERROR`: payload inválido na borda HTTP.

Catálogo público: [Error contract](../../integrations/errors.md).
