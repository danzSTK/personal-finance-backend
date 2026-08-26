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
- [x] 26. Adicionar configuração de TTL, cooldown, limite diário, path do frontend e mapping de infraestrutura do template lógico.
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

## Issue #76 - Política De Reenvio E Prazo De Entrega

### Spec E Contratos

- [x] 64. Atualizar requirements com cooldown exponencial, limite manual, Redis, deadline e rota de status.
- [x] 65. Atualizar design com arquitetura, contratos HTTP, Redis/Lua, schema, falhas e testes.
- [x] 66. Registrar todas as decisões e alternativas aprovadas em `decisions.md`.
- [x] 67. Documentar chaves Redis e cada script Lua planejado.
- [ ] 68. Revisar e aprovar `requirements.md`, `design.md` e esta lista antes de iniciar código.

### Constantes E Policy

- [ ] 69. Centralizar limite 5, janela 24h, cooldown inicial 60s, máximo 600s, janela útil 300s e TTL de mutação.
- [ ] 70. Remover `EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES` e `EMAIL_VERIFICATION_DAILY_LIMIT` da configuração, validação, `.env`, `.env.exemple` e docs.
- [ ] 71. Adicionar invariante de bootstrap entre TTL do token, cooldown máximo e janela útil mínima.
- [ ] 72. Criar policy pura e tipada para cálculo de cooldown, limite, restrição efetiva e retry.

### PostgreSQL E Domínio

- [ ] 73. Adicionar `origin` ao domínio, ORM entity e mapper de challenge usando const object e união literal.
- [ ] 74. Adicionar `deliverBefore` nullable ao domínio, ORM entity e mapper de `EmailMessage`.
- [ ] 75. Criar migration incremental com backfill `LEGACY_UNKNOWN`, constraints e unique partial do automático.
- [ ] 76. Atualizar `docs/database/schema.md` na mesma alteração da migration, cobrindo uma nova coluna em cada tabela.
- [ ] 77. Revisar SQL gerado e executar migration `up/down/up` em ambiente de teste.

### Redis E Lua

- [ ] 78. Adicionar as chaves de email verification ao `CacheKeys` com hash tag `{userId}`.
- [ ] 79. Criar a porta `IEmailVerificationResendStateStore` com uniões discriminadas explícitas.
- [ ] 80. Implementar e documentar `LOAD_EMAIL_VERIFICATION_RESEND_STATE_SCRIPT`.
- [ ] 81. Implementar e documentar `BEGIN_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT`.
- [ ] 82. Implementar e documentar `COMPLETE_EMAIL_VERIFICATION_LOGICAL_SEND_SCRIPT`.
- [ ] 83. Implementar e documentar `ABORT_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT`.
- [ ] 84. Implementar o adapter Redis com validação estrita de todos os retornos Lua.
- [ ] 85. Registrar store e dependências no módulo auth sem `forwardRef()` ou dependência circular.

### Casos De Uso E Envio

- [ ] 86. Refatorar criação de challenge para declarar `AUTOMATIC` ou `MANUAL_RESEND` e remover queries SQL de policy temporal.
- [ ] 87. Tornar o envio automático idempotente por usuário/purpose e registrar cooldown sem consumir limite manual.
- [ ] 88. Refatorar resend para begin/commit/abort Redis ao redor da transação PostgreSQL.
- [ ] 89. Calcular e persistir `deliver_before` ao criar intenção de verificação.
- [ ] 90. Cancelar intenção cujo prazo foi atingido antes de chamar o provider.
- [ ] 91. Fazer o processor lançar `UnrecoverableError` somente depois de persistir o estado terminal.
- [ ] 92. Garantir que o reconciliador continue ignorando `CANCELED`.

### Endpoint De Status E Erros

- [ ] 93. Criar `GetEmailVerificationResendStatusUseCase` sem mutação de negócio.
- [ ] 94. Criar os três response DTOs `available`, `blocked` e `already_verified`, cada um com `object` próprio.
- [ ] 95. Adicionar `GET /auth/email-verification/resend/status` com JWT, Swagger e `Cache-Control: no-store`.
- [ ] 96. Escrever `Retry-After` no status somente quando bloqueado.
- [ ] 97. Migrar cooldown e limite diário para `RetryAfterApplicationError`.
- [ ] 98. Adicionar `EMAIL_VERIFICATION_OPERATION_PENDING` e `EMAIL_VERIFICATION_STATE_UNAVAILABLE` e mapear no filtro global.
- [ ] 99. Atualizar `docs/integrations/errors.md`, referências auth e integração frontend.

### Testes E Validação

- [ ] 100. Testar policy nos limites exatos de cooldown, teto, janela móvel e limite manual.
- [ ] 101. Testar use cases de resend/status para disponível, bloqueios, ativo, chave ausente e Redis indisponível.
- [ ] 102. Testar scripts e adapter contra Redis real, incluindo concorrência e PTTL.
- [ ] 103. Testar migration/constraints/índice partial e mappers PostgreSQL.
- [ ] 104. Testar deadline antes, no instante e depois do limite sem chamar provider indevidamente.
- [ ] 105. Testar estado terminal SQL e `UnrecoverableError` no processor.
- [ ] 106. Criar/atualizar E2E de status, headers, cinco resends manuais e ausência de contagem automática.
- [ ] 107. Atualizar Swagger e documentação de integração, configuração, notifications e templates.
- [ ] 108. Rodar format, lint, build, unitários, integração e E2E aplicáveis.

### Fora De Escopo

- Prioridade de jobs/e-mails será tratada em feature separada e não faz parte das tarefas acima.

## Notas De Execução

- `npm run lint`, `npm run build` e `npm run test -- --runInBand` passaram com Node.js 22.22.2.
- `npm run test:e2e` foi executado, mas falhou antes de iniciar a app porque `test/jest-e2e.json` não resolve imports `@/`.
- Há testes novos para `EmailVerificationChallenge`, `EmailVerificationStatusGuard` e o handler de welcome que ignora `PENDING_EMAIL_VERIFICATION`; testes de use cases, repository/migration e fluxo E2E completo seguem pendentes.
