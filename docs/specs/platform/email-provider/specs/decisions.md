---
area: platform
feature: email-provider
type: spec-decisions
status: draft
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Email Provider

## DEC-001 - Criar infraestrutura em shared/mail

Status: proposed

Decision:
A base de envio de e-mails ficará em `api/src/shared/mail`.

Reason:
Envio de e-mail é uma capacidade transversal. O módulo `notifications` poderá usar essa infraestrutura futuramente, mas não deve ser criado apenas para hospedar detalhes de provider.

Impact:
O código de provider fica isolado da camada de domínio e de módulos de negócio.

## DEC-002 - Expor MailService como fachada

Status: proposed

Decision:
Módulos futuros usarão `MailService` para solicitar envio de e-mails.

Reason:
Uma fachada simples reduz acoplamento e centraliza validação, remetente padrão e tradução de erros.

Impact:
Trocar Brevo por SMTP ou outro provider exige alterar binding/adapter, não os consumidores.

## DEC-003 - Usar Brevo API como primeiro adapter

Status: proposed

Decision:
A primeira implementação real será `BrevoMailProvider`, chamando a API transacional da Brevo.

Reason:
O objetivo atual é consumir a API da Brevo, mas mantendo o contrato interno genérico.

Impact:
Credenciais e detalhes HTTP ficam restritos ao adapter Brevo.

## DEC-004 - Preferir fetch nativo inicialmente

Status: proposed

Decision:
O adapter Brevo deve começar usando `fetch` nativo do Node.js 22 em vez de SDK, salvo decisão posterior.

Reason:
O adapter precisa de poucos recursos: montar payload, enviar HTTP, tratar status e timeout. Evitar SDK reduz dependências e facilita troca de provider.

Impact:
O projeto assume responsabilidade pelo mapeamento HTTP mínimo da Brevo.

## DEC-005 - Criar NoopMailProvider

Status: proposed

Decision:
Criar provider `noop` para ambientes sem envio real.

Reason:
Testes e ambientes locais precisam validar wiring sem chamar serviço externo.

Impact:
`MAIL_ENABLED=false` ou `MAIL_PROVIDER=noop` permite subir a aplicação sem credencial Brevo.

## DEC-006 - Não criar consumers nesta spec

Status: accepted

Decision:
Esta spec não cria fila, worker, processor, handler de evento ou módulo `notifications`.

Reason:
O escopo aprovado é a infraestrutura de envio. Consumers pertencem a features de notificação específicas e devem ter specs próprias.

Impact:
A validação desta implementação será feita por testes de serviço/provider e wiring, não por fluxo assíncrono real.
