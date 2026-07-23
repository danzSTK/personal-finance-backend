---
area: auth
feature: email-verification
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Email Verification

- [x] 1. Atualizar documentação de base da spec se a revisão alterar regras de produto.
- [x] 2. Adicionar `PENDING_EMAIL_VERIFICATION` em `UserStatus`.
- [x] 3. Atualizar ORM entity de users para aceitar o novo status no `CHK_users_status`.
- [x] 4. Criar migration alterando `CHK_users_status`.
- [x] 5. Atualizar `docs/database/schema.md` para o novo status.
- [x] 6. Alterar sign-up credentials para criar usuário `PENDING_EMAIL_VERIFICATION`.
- [x] 7. Garantir que OAuth Google não seja alterado por esta feature.
- [x] 8. Adicionar método de domínio para marcar e-mail como verificado.
- [x] 9. Criar `UserEmailVerifiedEvent`.
- [x] 10. Criar hydrator de `user.email.verified`.
- [x] 11. Registrar hydrator em `UsersEventsModule` e `OutboxRehydratorsModule`.
- [x] 12. Criar decorator `@AllowPendingEmailVerification()`.
- [x] 13. Criar `EmailVerificationStatusGuard`.
- [x] 14. Registrar o guard global na composição da aplicação.
- [x] 15. Marcar `GET /users/me` como liberado para usuário pendente.
- [x] 16. Marcar `POST /auth/logout` como liberado para usuário pendente.
- [x] 17. Criar entidade de domínio `EmailVerificationChallenge`.
- [x] 18. Criar value object/helper de token de verificação.
- [x] 19. Criar interface `IEmailVerificationChallengeRepository`.
- [x] 20. Criar ORM entity `EmailVerificationChallengeOrmEntity`.
- [x] 21. Criar mapper de challenge usando `reconstitute()`.
- [x] 22. Criar repository TypeORM de challenges.
- [x] 23. Registrar repository e ORM entity no `AuthModule`.
- [x] 24. Criar migration da tabela `email_verification_challenges`.
- [x] 25. Atualizar `docs/database/schema.md` com a nova tabela, constraints e índices.
- [x] 26. Adicionar configuração de TTL, cooldown, limite diário, path do frontend e template id.
- [x] 27. Criar errors de aplicação de email verification.
- [x] 28. Mapear novos error codes no `AppExceptionFilter`.
- [x] 29. Atualizar `docs/integrations/errors.md`.
- [x] 30. Criar use case `CreateEmailVerificationChallengeUseCase`.
- [x] 31. Criar use case `ConfirmEmailVerificationUseCase`.
- [x] 32. Criar use case `ResendEmailVerificationUseCase`.
- [x] 33. Criar DTO HTTP de confirmação.
- [x] 34. Criar response DTOs de confirmação e resend com campo `object`.
- [x] 35. Criar endpoints `POST /auth/email-verification/confirm` e `POST /auth/email-verification/resend`.
- [x] 36. Adicionar throttle apropriado aos endpoints de verification.
- [x] 37. Adicionar constants de notifications para e-mail de verificação.
- [x] 38. Criar use case de criar intenção de e-mail de verificação.
- [x] 39. Criar handler de `user.created` para challenge/e-mail de verificação.
- [x] 40. Alterar handler de welcome em `user.created` para ignorar pendentes.
- [x] 41. Criar handler de `user.email.verified` para welcome email.
- [x] 42. Documentar template `email-verification`.
- [x] 43. Atualizar catálogo de templates.
- [x] 44. Atualizar docs de auth flows e endpoints.
- [x] 45. Criar docs de integração de email verification.
- [x] 46. Atualizar docs de eventos e mapa de eventos.
- [ ] 47. Criar testes de domínio de challenge e usuário.
- [ ] 48. Criar testes de use cases de confirm/resend/create challenge.
- [x] 49. Criar testes de guard e decorator.
- [ ] 50. Atualizar testes de sign-up e garantir ausência de regressão no OAuth.
- [x] 51. Criar/atualizar testes de notification handlers.
- [ ] 52. Criar testes de repository/migration quando aplicável.
- [ ] 53. Criar E2E do fluxo completo de sign-up pendente, bloqueio, resend, confirmação e acesso liberado.
- [x] 54. Rodar `npm run test`.
- [x] 55. Rodar `npm run test:e2e` se ambiente estiver disponível.
- [x] 56. Rodar `npm run lint`.
- [x] 57. Rodar `npm run build`.
- [x] 58. Revisar SQL gerado/aplicado e conferir `docs/database/schema.md`.
- [x] 59. Mover `Email` para value object compartilhado.
- [x] 60. Validar `EmailVerificationChallenge.email` com as regras de e-mail da plataforma.
- [x] 61. Adicionar variáveis de email verification no `.env` e `.env.exemple`.
- [x] 62. Criar migration incremental para alinhar `email_verification_challenges.email` com `varchar(255)`.
- [x] 63. Liberar `AuthController` para usuários `PENDING_EMAIL_VERIFICATION`.

## Notas De Execução

- `npm run lint`, `npm run build` e `npm run test -- --runInBand` passaram com Node.js 22.22.2.
- `npm run test:e2e` foi executado, mas falhou antes de iniciar a app porque `test/jest-e2e.json` não resolve imports `@/`.
- Há testes novos para `EmailVerificationChallenge`, `EmailVerificationStatusGuard` e o handler de welcome que ignora `PENDING_EMAIL_VERIFICATION`; testes de use cases, repository/migration e fluxo E2E completo seguem pendentes.
