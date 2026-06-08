---
status: temporary
area: platform-errors
---

# Error Handling Tasks

- [x] Criar `DomainError` e `ApplicationError`.
- [x] Criar erros específicos começando por username.
- [x] Criar `AppExceptionFilter`.
- [x] Padronizar `ValidationPipe.exceptionFactory`.
- [x] Migrar `UserName` para `InvalidUsernameFormatError`.
- [x] Migrar use cases de auth/users para `ApplicationError`.
- [x] Migrar accounts/categories para `DomainError` e `ApplicationError`.
- [ ] Documentar catálogo de error codes em `docs/integrations/errors.md`.
