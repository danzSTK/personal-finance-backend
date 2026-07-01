---
area: notifications
feature: welcome-email
type: spec-tasks
status: implemented
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks - Welcome Email

## Spec

- [x] 1. Criar requirements.
- [x] 2. Criar design.
- [x] 3. Criar tasks.
- [x] 4. Registrar decisões iniciais.

## Documentação Obrigatória

- [x] 5. Criar documentação inicial do catálogo de templates.
- [x] 6. Criar documentação inicial do template `welcome-email`.
- [x] 7. Revisar documentação do template após implementação.
- [x] 8. Atualizar `docs/notifications/README.md`.
- [x] 9. Garantir que cada template futuro tenha key, provider, provider id, parâmetros e caso de uso documentados.

## Domínio

- [x] 10. Criar enum/status de `EmailMessage`.
- [x] 11. Criar entidade `EmailMessage`.
- [x] 12. Criar value object/constante para template key.
- [x] 13. Criar interface `IEmailMessageRepository`.
- [x] 14. Testar regras da entidade.

## Persistência

- [x] 15. Criar ORM entity `EmailMessageOrmEntity`.
- [x] 16. Criar mapper `EmailMessageMapper`.
- [x] 17. Criar repository TypeORM.
- [x] 18. Criar migration da tabela `email_messages`.
- [x] 19. Criar unique index de `idempotency_key`.
- [x] 20. Testar repository/idempotência.

## Configuração

- [x] 21. Criar config de notifications.
- [x] 22. Adicionar validação Joi para paths/links de notifications.
- [x] 23. Atualizar `.env.exemple`.

## Use Cases

- [x] 24. Criar `CreateWelcomeEmailMessageUseCase`.
- [x] 25. Tratar unique violation como sucesso idempotente.
- [x] 26. Criar `SendEmailMessageUseCase`.
- [x] 27. Mapear params do template Brevo `2`.
- [x] 28. Atualizar status em sucesso/falha.
- [x] 29. Testar use cases.

## Queue E Worker

- [x] 30. Registrar fila `notifications.email`.
- [x] 31. Criar porta `EmailJobQueue`.
- [x] 32. Criar adapter BullMQ.
- [x] 33. Gerar `jobId = email-message-<emailMessageId>`.
- [x] 34. Garantir que `jobId` não usa `:`.
- [x] 35. Criar processor `EmailMessageProcessor`.
- [x] 36. Testar queue adapter e processor.

## Eventos

- [x] 37. Criar handler `EnqueueWelcomeEmailOnUserCreatedHandler`.
- [x] 38. Garantir idempotência por `email:welcome:user:<userId>`.
- [x] 39. Testar republicação de evento.

## Módulo

- [x] 40. Criar `NotificationsModule`.
- [x] 41. Registrar providers/repository/queue/processor.
- [x] 42. Importar `NotificationsModule` no `AppModule`.

## Validação

- [x] 43. Rodar testes relevantes.
- [x] 44. Rodar build.
- [x] 45. Rodar lint focado.

## Ajustes De Fechamento

- [x] 46. Atualizar `docs/database/schema.md` com `email_messages`.
- [x] 47. Adicionar migration incremental para `trg_email_messages_updated_at`.
- [x] 48. Registrar decisão de não enviar `idempotency_key` como metadata/header do provider.
- [x] 49. Atualizar regras do projeto para exigir leitura e atualização do schema central em migrations.

## Fora Do Escopo

- [x] 50. Não criar `email_delivery_attempts`.
- [x] 51. Não criar coluna `bullmq_job_id`.
- [x] 52. Não criar coluna `job_id` no v1.
- [x] 53. Não criar endpoint HTTP.
- [x] 54. Não implementar webhooks Brevo.
