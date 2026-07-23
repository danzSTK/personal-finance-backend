---
area: notifications
feature: welcome-email
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Welcome Email

## DEC-001 - Criar NotificationsModule

Status: accepted

Decision:
Criar `api/src/modules/notifications` para coordenar templates, intenções de envio e workers de notificação.

Reason:
Notifications é um bounded context próprio: decide o que comunicar e quando. O `shared/mail` apenas sabe enviar.

Impact:
O módulo passa a consumir eventos de outros módulos e usar `MailService` como infraestrutura transversal.

## DEC-002 - EmailMessage representa intenção idempotente

Status: accepted

Decision:
`email_messages` representa uma intenção única de envio, não um log detalhado de tentativas.

Reason:
Para v1, estado atual, contador de tentativas e último erro entregam debug suficiente sem criar `email_delivery_attempts`.

Impact:
Histórico detalhado por tentativa poderá ser adicionado depois sem quebrar a entidade principal.

## DEC-003 - Não persistir job_id no v1

Status: accepted

Decision:
Não persistir `job_id` em `email_messages` no v1.

Reason:
O job id é derivado de `emailMessage.id`, então guardar seria redundante.

Impact:
Debug reconstrói o job id com `email-message-<emailMessageId>`.

## DEC-004 - Não usar nomes de tecnologia no banco

Status: accepted

Decision:
Não criar colunas como `bullmq_job_id`.

Reason:
BullMQ é detalhe de infraestrutura. O banco deve modelar conceitos da aplicação, não fornecedores ou bibliotecas.

Impact:
Se um dia mudarmos de BullMQ, a tabela de notifications continua válida.

## DEC-005 - Separar idempotency_key de jobId

Status: accepted

Decision:
Usar `idempotency_key = email:welcome:user:<userId>` no banco e `jobId = email-message-<emailMessageId>` na fila.

Reason:
`idempotency_key` é chave de negócio e pode usar `:`. BullMQ pode restringir `:` no `jobId`, então a fila usa formato sanitizado.

Impact:
A idempotência fica legível e estável no banco; a fila recebe identificador compatível.

## DEC-006 - Documentar templates como contrato

Status: accepted

Decision:
Cada template deve ter documentação própria com key, provider, provider id, params e caso de uso.

Reason:
Templates vivem fora do código, no provider. A documentação vira o contrato entre backend e Brevo.

Impact:
Nenhum template novo deve ser usado sem doc em `docs/notifications/email-templates`.

## DEC-007 - Usar BullMQ para welcome email

Status: accepted

Decision:
Enviar welcome email por job assíncrono, não diretamente no handler de evento.

Reason:
E-mail é efeito externo retentável e não deve bloquear criação de usuário nem publicação do evento.

Impact:
O handler cria intenção idempotente e enfileira job; o worker envia.

## DEC-008 - Reenfileirar intenção existente não terminal

Status: accepted

Decision:
Quando o evento for republicado e a intenção já existir em estado reenfileirável (`PENDING` ou `FAILED_RETRYABLE`), o handler pode enfileirar novamente usando o mesmo `jobId` derivado.

Reason:
Se a intenção foi salva e a escrita na fila falhou, uma nova publicação do outbox recupera o fluxo sem criar outra linha nem outro e-mail lógico.

Impact:
Estados terminais não geram novo job. Estados reenfileiráveis dependem da deduplicação determinística do adapter de fila.

## DEC-009 - Usar trigger padrão para updated_at em email_messages

Status: accepted

Decision:
Adicionar `trg_email_messages_updated_at` usando a função existente `set_updated_at()`.

Reason:
`email_messages` possui `updated_at` e deve seguir o contrato de schema já documentado para tabelas da aplicação, sem criar nova função duplicada.

Impact:
A migration já aplicada de criação da tabela não será alterada. O ajuste entra por migration incremental.

## DEC-010 - Não enviar idempotency_key como metadata do provider

Status: accepted

Decision:
Enviar para a Brevo apenas a metadata curta `X-Danfy-Email-Message-Id`, sem incluir `idempotency_key`.

Reason:
A Brevo rejeita metadata/header com chave de idempotência longa. A idempotência de negócio já é persistida em `email_messages.idempotency_key`, então o provider não precisa receber esse valor.

Impact:
Debug externo usa `X-Danfy-Email-Message-Id` e debug interno reconstrói a intenção pelo banco.

## DEC-011 - Tratar usuário ausente como falha operacional

Status: accepted

Decision:
`CreateWelcomeEmailMessageUseCase` deve lançar erro de aplicação quando o `userId` do evento não existir no repositório de usuários.

Reason:
O evento `user.created` referencia uma entidade que deveria existir. Usar o e-mail do payload como fallback mascara inconsistência operacional e pode enviar welcome email para uma conta inexistente ou removida.

Impact:
O fluxo ainda é idempotente quando a intenção já existe. Para intenção nova, usuário ausente passa a falhar explicitamente e pode ser investigado por logs/monitoramento.

## DEC-012 - Nomear a porta de enfileiramento como producer

Status: accepted

Decision:
Renomear `EmailJobQueue` para `EmailJobQueueProducer` e o adapter BullMQ correspondente para `BullmqEmailJobQueueProducer`.

Reason:
A porta de aplicação não representa a fila completa; ela apenas produz jobs de envio. O nome explícito reduz ambiguidade entre producer e processor.

Impact:
Imports e testes do módulo notifications devem ser atualizados, sem mudança de comportamento na fila BullMQ.

## DEC-013 - Logar jobs concluídos sem envio

Status: accepted

Decision:
`EmailMessageProcessor` deve logar quando `SendEmailMessageUseCase` retornar `sent = false`.

Reason:
Falhas permanentes e estados terminais podem concluir o job sem retry no BullMQ. Sem log, a única trilha fica no banco, dificultando diagnóstico operacional.

Impact:
Jobs não retentáveis continuam concluindo com sucesso no BullMQ para evitar retries indevidos, mas deixam log com `emailMessageId`, `jobId` e status final.
