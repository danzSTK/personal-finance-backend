# Módulo Auth — Instruções Locais

Este módulo é responsável pelos fluxos de autenticação, emissão e rotação de tokens JWT, estratégias Passport (Local, JWT, Google OAuth) e verificação de e-mail.

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/auth/README.md` — Índice e mapa de fluxos de autenticação.
- `docs/auth/flows/sign-in.md`, `sign-up.md`, `change-password.md` — Ciclos de vida de credenciais e sessões.
- `docs/auth/concepts/local-password-policy.md` — Políticas de senha e limite UTF-8.
- `docs/auth/reference/redis-keys.md` — Padrões de chaves Redis para sessões e blacklists.

## Regras de Fronteira e Invariantes
- **Tokens e Cookies:** JWTs são emitidos e retornados em cookies HTTP-only seguros; nunca exponha tokens no corpo da resposta para endpoints de login normal.
- **Isolamento de Credenciais:** `passwordHash` e `refreshTokenHash` nunca devem ser retornados para presentation DTOs e possuem `{ select: false }` no ORM.
- **Comunicação com Usuários:** Criação e alteração de senha usam use cases ou eventos; respeite as invariantes do agregado `User`.
