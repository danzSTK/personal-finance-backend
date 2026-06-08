---
status: temporary
area: platform-errors
---

# Error Handling Tasks

- [x] Criar `DomainError` e `ApplicationError`.
- [x] Criar erros específicos começando por username.
- [x] Criar `AppExceptionFilter`.
- [x] Padronizar `ValidationPipe.exceptionFactory`.
- [ ] Migrar `UserName` para `InvalidUsernameFormatError`.
- [ ] Migrar use cases de auth/users para `ApplicationError`.
- [ ] Migrar accounts/categories para `DomainError` e `ApplicationError`.
- [ ] Documentar catálogo de error codes em `docs/integrations/errors.md`.
