---
area: users
type: flow
status: current
---

# Change Username

Alterar username é um fluxo separado do patch genérico de perfil para preservar normalização, unicidade global e tratamento previsível de concorrência.

## Entrada

- usuário autenticado;
- `username` no body da request;
- texto entre 3 e 50 caracteres;
- letras, números, `_` e `-`.

O valor é normalizado com `trim()` e lowercase antes da validação de domínio e da persistência.

## Fluxo

```text
UsersController
  -> UpdateUsernameUseCase
  -> UserName.create
  -> IUserRepository.findByIdForUpdate
  -> IUserRepository.findByUserName
  -> User.changeUserName
  -> IUserRepository.save
  -> UserProfileResponseDto
```

## Regras

- O usuário vem da sessão autenticada, nunca do body.
- A alteração executa em transação.
- A linha do usuário é bloqueada com `pessimistic_write` durante a mudança.
- Se o username normalizado for igual ao atual, a operação retorna sucesso sem salvar novamente.
- Se outro usuário já possuir o username, o fluxo retorna conflito.
- Se uma corrida passar pela checagem de disponibilidade e o banco rejeitar a unicidade, o erro é convertido para `USERNAME_ALREADY_EXISTS`.
- O cache de perfil invalida tanto o username antigo quanto o novo.

## Throttling

`PUT /users/me/username` aceita 3 tentativas por minuto e bloqueia novas tentativas por 10 minutos após exceder o limite.

## Erros

- `VALIDATION_ERROR`: body inválido na borda HTTP.
- `INVALID_USERNAME_FORMAT`: username viola as regras do value object.
- `USERNAME_ALREADY_EXISTS`: username já pertence a outro usuário.
- `USER_NOT_FOUND`: usuário autenticado não existe mais.
- `UNAUTHORIZED`: sessão ausente ou inválida.
- `TOO_MANY_REQUESTS`: limite de tentativas excedido.

Endpoint e contrato HTTP: [Change username integration](../../integrations/users/update-username.md).
