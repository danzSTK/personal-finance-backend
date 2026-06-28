---
area: platform
feature: email-provider
type: spec-tasks
status: draft
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

## Configuração

- [ ] 5. Criar `api/src/config/mail.config.ts`.
- [ ] 6. Registrar `mailConfig` no load do `ConfigModule`.
- [ ] 7. Adicionar validação Joi para `MAIL_*` e `BREVO_*`.
- [ ] 8. Atualizar `.env.exemple`.

## Contratos E Serviço

- [ ] 9. Criar interfaces `MailAddress`, `SendMailInput` e `SendMailResult`.
- [ ] 10. Criar porta abstrata `MailProvider`.
- [ ] 11. Criar `MailService`.
- [ ] 12. Implementar validação de payload mínimo.
- [ ] 13. Aplicar remetente padrão no `MailService`.

## Providers

- [ ] 14. Criar `NoopMailProvider`.
- [ ] 15. Criar `BrevoMailProvider`.
- [ ] 16. Mapear `SendMailInput` para payload Brevo.
- [ ] 17. Implementar timeout na chamada Brevo.
- [ ] 18. Criar binding de provider no `MailModule`.

## Erros

- [ ] 19. Criar `MailError`.
- [ ] 20. Criar catálogo de códigos de erro.
- [ ] 21. Criar mapper de erros Brevo/HTTP para `MailError`.
- [ ] 22. Garantir sanitização de segredos em erros/logs.

## Módulo

- [ ] 23. Criar `api/src/shared/mail/mail.module.ts`.
- [ ] 24. Exportar `MailService`.
- [ ] 25. Registrar `MailModule` no `AppModule`.

## Documentação

- [ ] 26. Criar `docs/platform/email-provider.md`.
- [ ] 27. Atualizar `docs/platform/README.md`.
- [ ] 28. Documentar configuração Brevo.
- [ ] 29. Documentar como trocar provider.
- [ ] 30. Documentar que consumers, filas e notifications ficam fora desta spec.

## Testes

- [ ] 31. Testar `mail.config.ts`.
- [ ] 32. Testar `MailService`.
- [ ] 33. Testar `NoopMailProvider`.
- [ ] 34. Testar `BrevoMailProvider` com `fetch` mockado.
- [ ] 35. Testar mapper de erros.
- [ ] 36. Testar wiring do `MailModule`.

## Validação

- [ ] 37. Rodar testes relevantes.
- [ ] 38. Rodar build.
- [ ] 39. Rodar lint focado nos arquivos alterados.

## Fora Do Escopo Desta Implementação

- [ ] 40. Não criar módulo `notifications`.
- [ ] 41. Não criar fila BullMQ.
- [ ] 42. Não criar consumer/worker/processor.
- [ ] 43. Não criar template real de e-mail.
- [ ] 44. Não alterar fluxos de negócio existentes.
