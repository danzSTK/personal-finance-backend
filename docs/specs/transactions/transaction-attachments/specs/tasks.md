---
area: transactions
feature: transaction-attachments
type: spec-tasks
status: approved
issue: 131
related:
  - ./requirements.md
  - ./design.md
  - ./decisions.md
---

# Tasks — Transaction Attachments

## 1. Infraestrutura e Storage (`shared/object-storage`)

- [ ] 1. Instalar `@aws-sdk/s3-request-presigner` no `api/package.json`.
- [ ] 2. Adicionar métodos `buildSignedReadUrl` e `getObject` no contrato `IObjectStorage` (`api/src/shared/object-storage/contracts/object-storage.interface.ts`).
- [ ] 3. Implementar `buildSignedReadUrl` e `getObject` no `S3ObjectStorageAdapter` com validação de bucket privado e expiração de 300s.
- [ ] 4. Ajustar `putObject` no `S3ObjectStorageAdapter` para aplicar `CacheControl: 'private, max-age=300'` quando o bucket for privado.
- [ ] 5. Criar testes unitários no `s3-object-storage.adapter.spec.ts` para os novos métodos e headers.

## 2. Banco de Dados e Migrations

- [ ] 6. Criar migration TypeORM `AddTransactionAttachmentsAndExpandAssetPurpose` criando `transaction_attachments` e expandindo `CHK_assets_purpose`.
- [ ] 7. Atualizar `docs/database/schema.md` com a nova tabela `transaction_attachments` e o check constraint expandido.

## 3. Domínio e Persistência de Transactions e Assets

- [ ] 8. Adicionar `TRANSACTION_ATTACHMENT` ao enum `AssetPurpose` e implementar a geração da storage key em `AssetStorageKeyFactory` (`users/{userId}/transaction-attachments/{assetId}`).
- [ ] 9. Criar a entidade de domínio `TransactionAttachment` e os erros de domínio/aplicação de anexos.
- [ ] 10. Criar entidade ORM `TransactionAttachmentOrmEntity` e registrar em `entities.ts` e `TransactionsModule`.
- [ ] 11. Implementar `ITransactionAttachmentRepository` e `TransactionAttachmentRepository` TypeORM com suporte a locks e transações.

## 4. Casos de Uso da Aplicação (Transactions)

- [ ] 12. Criar `TransactionAttachmentImageValidator` para validação de magic bytes (`file-type`), 5 MB e teto de 60 MP com Sharp metadata.
- [ ] 13. Implementar `AddTransactionAttachmentsUseCase` (validação, reserva sob lock `FOR UPDATE`, upload para bucket privado, `markReady` e enqueue BullMQ).
- [ ] 14. Implementar `ListTransactionAttachmentsUseCase` (busca anexos da transação e gera Presigned URLs com cache cliente de 240s).
- [ ] 15. Implementar `DeleteTransactionAttachmentUseCase` (desvincula anexo, reordena posições e marca asset como `DELETE_PENDING`).
- [ ] 16. Implementar `ReorderTransactionAttachmentsUseCase` (reordena posições da galeria sob transação).
- [ ] 17. Atualizar `DeleteTransactionUseCase` para adquirir lock `FOR UPDATE` e marcar todos os anexos vinculados em `READY` como `DELETE_PENDING` na mesma transação PostgreSQL.
- [ ] 18. Criar testes unitários para todos os use cases.

## 5. Otimização Assíncrona no Worker (BullMQ + Sharp)

- [ ] 19. Criar fila e producer `TransactionAttachmentJobQueueProducer` no módulo transactions.
- [ ] 20. Implementar `TransactionAttachmentOptimizationProcessor` no Worker (download do R2 privado, Sharp rotate/strip/resize 2560x2560/webp q80, checagem de estado `READY` sob lock e sobrescrita segura).
- [ ] 21. Registrar a fila e o processor em `TransactionsWorkerModule` importado no `WorkerModule`.
- [ ] 22. Criar testes unitários do processor BullMQ.

## 6. Camada HTTP (Controllers e DTOs)

- [ ] 23. Atualizar `TransactionsController` (`GET /transactions` e `GET /:id`) para expor `attachmentsCount`.
- [ ] 24. Criar `TransactionAttachmentsController` com as rotas `GET /:id/attachments`, `POST /:id/attachments`, `DELETE /:id/attachments/:attachmentId` e `PATCH /:id/attachments/positions`.
- [ ] 25. Criar DTOs com validação class-validator e Swagger decorators.
- [ ] 26. Mapear novos códigos de erro no `AppExceptionFilter`.

## 7. Documentação Modular Viva

- [ ] 27. Atualizar `docs/storage/README.md` documentando a topologia de duplo bucket (Público vs Privado) e Presigned URLs.
- [ ] 28. Criar documentação modular viva em `docs/transactions/` (`README.md`, `concepts/`, `flows/`, `decisions/`).

## 8. Verificação e QA

- [ ] 29. Executar suite de lint (`npm run lint`), typecheck (`npm run typecheck`), build (`npm run build`) e testes (`npm test`).
- [ ] 30. Validar comportamento local com PostgreSQL e Worker.
