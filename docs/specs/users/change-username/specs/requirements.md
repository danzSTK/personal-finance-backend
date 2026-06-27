---
area: users
feature: change-username
type: requirements
status: current
---

# Change Username Requirements

## Objetivo

Permitir que o usuário autenticado altere seu próprio username sem usar o patch genérico de perfil.

## Contexto

- `docs/users/README.md`
- `docs/users/flows/change-username.md`
- `docs/integrations/users/update-username.md`
- `docs/integrations/errors.md`

## Escopo

- Criar endpoint autenticado `PUT /users/me/username`.
- Normalizar o username com trim e lowercase.
- Validar o formato pelo value object `UserName`.
- Garantir unicidade global.
- Retornar o perfil atualizado.
- Documentar o contrato HTTP para integração frontend.
- Aplicar throttling mais agressivo para evitar abuso.

## Fora de Escopo

- Alteração de email.
- Reserva de usernames especiais.
- Histórico público de usernames anteriores.
- Confirmação por email ou senha para trocar username.

## Regras

WHEN o usuário envia um username válido e disponível
THE SYSTEM SHALL persistir o username normalizado e retornar `200`.

WHEN o username normalizado é igual ao username atual
THE SYSTEM SHALL retornar sucesso sem nova escrita.

WHEN outro usuário já possui o username
THE SYSTEM SHALL retornar `409` com `USERNAME_ALREADY_EXISTS`.

WHEN o username viola tamanho ou caracteres permitidos
THE SYSTEM SHALL retornar erro estável de validação ou domínio.

WHEN duas requests concorrentes tentam usar o mesmo username
THE SYSTEM SHALL converter a rejeição de unicidade do banco para `USERNAME_ALREADY_EXISTS`.

WHEN o usuário excede o limite da rota
THE SYSTEM SHALL retornar `429` com `TOO_MANY_REQUESTS`.

## Aceitação

- `PUT /users/me/username` não aceita `userId` no body.
- O username salvo é lowercase.
- O cache de username antigo e novo é invalidado após a mudança.
- O response `200` usa `UserProfileResponseDto`.
- A documentação de integração lista body, response, erros e throttling.
