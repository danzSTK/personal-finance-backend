---
area: auth
type: flow
status: current
related:
  - ../change-password/index.md
  - ../change-password/flow/README.md
  - ../change-password/decisions/README.md
  - ../reference/endpoints.md
  - ../reference/error-codes.md
  - ../reference/redis-keys.md
  - ../../specs/auth/change-password/specs/design.md
---

# Alteração de senha autenticada

`POST /auth/password/change` recebe `currentPassword` e `newPassword`. O usuário
e a sessão vêm do JWT validado; o body nunca escolhe ownership.

Fluxo resumido:

1. o guard técnico limita custo por fingerprints HMAC de IP e sessão;
2. Redis informa bloqueio, cooldown, limite diário ou mutação pendente;
3. estado ausente é reconstruído por `password_change_events`;
4. uma barreira Redis serializa o fluxo antes do bcrypt;
5. a transação bloqueia o usuário e confirma a senha atual;
6. falha grava auditoria e pode iniciar um bloqueio;
7. sucesso troca o hash, incrementa `credential_version` e grava outbox;
8. os tokens anteriores falham pela versão e as sessões Redis são removidas;
9. a resposta limpa os cookies de access e refresh.

O primeiro bloqueio após cinco falhas em 15 minutos dura uma hora. Um novo
bloqueio iniciado até 24 horas depois do anterior dura 24 horas. Alterações
concluídas possuem cooldown de 10 minutos e limite de três em 24 horas.

O PostgreSQL é o histórico auditável. Redis é a projeção operacional e usa
`noeviction`; indisponibilidade impede temporariamente esta ação crítica.

Antes de abrir a tela, o frontend pode chamar
`GET /auth/password/change/status`. A rota autenticada reutiliza a mesma projeção
e policy, retorna `status: true|false` e inclui `Retry-After` somente quando o
status é falso. Ela não revela a causa, não consome o limite técnico específico
do `POST` e não substitui a validação feita no momento da alteração.

Detalhes de implementação e decisões estão no índice de
[alteração de senha](../change-password/index.md).
