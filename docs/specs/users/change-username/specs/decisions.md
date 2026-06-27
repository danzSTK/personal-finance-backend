---
area: users
feature: change-username
type: decisions
status: current
---

# Change Username Decisions

## DEC-001 - Username Fora Do Patch Geral

Status: accepted

Decision:
Manter `PUT /users/me/username` separado de `PATCH /users/me`.

Reason:
Username exige normalização, unicidade global, disponibilidade e concorrência, enquanto o patch geral edita apenas campos simples de perfil.

Impact:
O frontend deve chamar uma rota dedicada para username.

## DEC-002 - Checagem Prévia Mais Constraint Única

Status: accepted

Decision:
Checar `findByUserName` antes de salvar e também mapear a constraint `UQ_user_name` para `USERNAME_ALREADY_EXISTS`.

Reason:
A checagem prévia melhora o fluxo esperado, mas só o banco resolve corridas entre requests concorrentes.

Impact:
O contrato frontend recebe sempre `409 USERNAME_ALREADY_EXISTS`, sem erro bruto de banco.

## DEC-003 - Invalidar Username Antigo E Novo

Status: accepted

Decision:
Ao salvar usuário, buscar o estado anterior e invalidar caches do username anterior e do novo.

Reason:
Sem invalidar o valor antigo, o Redis pode manter índice ou disponibilidade incorretos até o TTL expirar.

Impact:
O save do repositório cacheado faz uma leitura adicional antes de persistir usuário existente.

## DEC-004 - Resposta Resolve AvatarUrl

Status: accepted

Decision:
As respostas de perfil do controller passam pelo `GetUserProfileUseCase` antes de serializar `UserProfileResponseDto`.

Reason:
O DTO público inclui `avatarUrl`; retornar `null` depois de uma alteração simples poderia apagar o avatar no cache do frontend.

Impact:
Rotas que retornam perfil fazem uma consulta adicional ao asset quando o usuário possui avatar.
