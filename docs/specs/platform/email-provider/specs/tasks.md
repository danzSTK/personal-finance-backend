---
area: platform
feature: email-provider
type: spec-tasks
status: current
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Email Provider

## Spec

- [x] 1. Criar requirements.
- [x] 2. Criar design.
- [x] 3. Criar tasks.
- [x] 4. Registrar decisões iniciais.

## Dependências

- [x] 5. Adicionar `@getbrevo/brevo` em `api/package.json`.
- [x] 6. Atualizar lockfile.

## Configuração

- [x] 7. Criar `api/src/config/mail.config.ts`.
- [x] 8. Registrar `mailConfig` no load do `ConfigModule`.
- [x] 9. Adicionar validação Joi para `MAIL_*` e `BREVO_*`.
- [x] 10. Atualizar `.env.exemple`.

## Contratos E Serviço

- [x] 11. Criar interfaces `MailAddress`, `SendMailInput` e `SendMailResult`.
- [x] 12. Criar porta abstrata `MailProvider`.
- [x] 13. Criar `MailService`.
- [x] 14. Implementar validação de payload mínimo.
- [x] 15. Aplicar remetente padrão no `MailService`.

## Providers

- [x] 16. Criar `NoopMailProvider`.
- [x] 17. Criar `BrevoMailProvider`.
- [x] 18. Mapear `SendMailInput` para payload do SDK Brevo.
- [x] 19. Criar binding de provider no `MailModule`.

## Erros

- [x] 20. Criar `MailError`.
- [x] 21. Criar catálogo de códigos de erro.
- [x] 22. Criar mapper de erros Brevo/SDK/HTTP para `MailError`.
- [x] 23. Garantir sanitização de segredos em erros/logs.

## Módulo

- [x] 24. Criar `api/src/shared/mail/mail.module.ts`.
- [x] 25. Exportar `MailService`.
- [x] 26. Registrar `MailModule` no `AppModule`.

## Documentação

- [x] 27. Criar `docs/platform/email-provider.md`.
- [x] 28. Atualizar `docs/platform/README.md`.
- [x] 29. Documentar configuração Brevo.
- [x] 30. Documentar como trocar provider via adapter/classe.
- [x] 31. Documentar que consumers, filas e notifications ficam fora desta spec.

## Testes

- [x] 32. Testar `mail.config.ts`.
- [x] 33. Testar `MailService`.
- [x] 34. Testar `NoopMailProvider`.
- [x] 35. Testar `BrevoMailProvider` com SDK mockado.
- [x] 36. Testar mapper de erros.
- [x] 37. Testar wiring do `MailModule`.

## Validação

- [x] 38. Rodar testes relevantes.
- [x] 39. Rodar build.
- [x] 40. Rodar lint focado nos arquivos alterados.

Observação: o lint global foi executado e ainda falha em `api/src/modules/users/application/use-cases/update-username/update-username.use-case.spec.ts`, fora do escopo desta spec.

## Fora Do Escopo Desta Implementação

- [x] 41. Não criar módulo `notifications`.
- [x] 42. Não criar fila BullMQ.
- [x] 43. Não criar consumer/worker/processor.
- [x] 44. Não criar template real de e-mail.
- [x] 45. Não alterar fluxos de negócio existentes.
- [x] 46. Não implementar SMTP.
