---
area: accounts
type: reference
status: current
related:
  - ../../integrations/accounts/README.md
---

# Endpoints Accounts

| Método | Rota | Auth | Status principal | Descrição |
|---|---|---|---:|---|
| `POST` | `/accounts` | `JwtAuthGuard` | `201` | Cria account |
| `GET` | `/accounts` | `JwtAuthGuard` | `200` | Lista accounts ativas por padrão |
| `PATCH` | `/accounts/:id` | `JwtAuthGuard` | `200` | Atualiza account |
| `PATCH` | `/accounts/:id/archive` | `JwtAuthGuard` | `204` | Arquiva account |
| `PATCH` | `/accounts/:id/unarchive` | `JwtAuthGuard` | `204` | Desarquiva account |
| `PATCH` | `/accounts/:id/default` | `JwtAuthGuard` | `204` | Define account default |

Todos os endpoints usam o usuário autenticado como fonte de `userId`.
