---
area: users
feature: change-username
type: design
status: current
---

# Change Username Design

## Camadas

Presentation:

- `UsersController.changeUsername`
- `UpdateUsernameDto`
- Swagger com `ApiOperation`, `ApiBody` e respostas de erro.

Application:

- `UpdateUsernameUseCase`
- Orquestra transação, busca bloqueante do usuário, checagem de unicidade e persistência.

Domain:

- `UserName.create` normaliza e valida.
- `User.changeUserName` altera estado e `updatedAt`.

Infrastructure:

- `IUserRepository.findByIdForUpdate`
- `IUserRepository.findByUserName`
- `IUserRepository.save`
- `RedisUserCacheInvalidator`

## Fluxo

1. Controller recebe usuário autenticado via `@CurrentUser()`.
2. DTO normaliza o body com `TrimAndLowerCase`.
3. Use case abre transação.
4. Repositório bloqueia o usuário por id.
5. `UserName.create` valida e normaliza de novo no domínio.
6. Use case retorna sem salvar se o valor normalizado for igual ao atual.
7. Use case consulta se outro usuário já possui o username.
8. Domínio aplica a mudança.
9. Repositório salva e invalida caches relacionados.
10. Controller resolve `avatarUrl` e retorna `UserProfileResponseDto`.

## Validação E Erros

- DTO cobre tipo, vazio e tamanho.
- Domínio cobre formato, tamanho e normalização confiável.
- `USERNAME_ALREADY_EXISTS` cobre conflito por checagem prévia e corrida no índice único.
- `USER_NOT_FOUND` cobre usuário autenticado ausente no banco.
- `TOO_MANY_REQUESTS` vem do throttler global.

## Persistência E Cache

Não há migration nova: `users.user_name` já existe e tem constraint única `UQ_user_name`.

O cache precisa invalidar:

- `users:id:<userId>`;
- `users:email-index:<email>`;
- `users:username-index:<username antigo>`;
- `users:username-index:<username novo>`;
- `users:username-exists:<username antigo>`;
- `users:username-exists:<username novo>`.

## Segurança

- O `userId` vem exclusivamente do JWT.
- A rota exige sessão autenticada.
- Throttling da rota: 3 tentativas por minuto, bloqueio por 10 minutos.

## Testes

- Use case atualiza username em transação.
- Use case não salva quando o username normalizado é igual ao atual.
- Use case rejeita username já usado por outro usuário.
- Use case converte violação de unicidade do Postgres para `USERNAME_ALREADY_EXISTS`.
- Use case retorna `USER_NOT_FOUND` quando o usuário autenticado não existe.

## Documentação

- Atualizar `docs/users/README.md`.
- Criar `docs/users/flows/change-username.md`.
- Criar `docs/integrations/users/update-username.md`.
- Atualizar `docs/integrations/users/README.md`.
- Registrar throttling em avatar e username.
