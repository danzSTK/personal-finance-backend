---
area: platform
feature: email-provider
type: spec-requirements
status: draft
related:
  - ../../../../platform/README.md
  - ../../../../specs/platform/queue-infrastructure/specs/design.md
---

# Requirements - Email Provider

## Objetivo

Construir a base de envio de e-mails da aplicação por trás de uma abstração estável, permitindo usar a API da Brevo inicialmente e trocar o provedor no futuro sem alterar módulos de negócio.

O resultado esperado é um `MailService` reutilizável por um futuro módulo `notifications`, capaz de delegar o envio para adapters como Brevo API, SMTP ou outro provedor transacional.

## Contexto

A aplicação ainda não possui infraestrutura própria para envio de e-mails. A próxima etapa desejada é consumir a API da Brevo, mas sem acoplar casos de uso, handlers ou módulos futuros diretamente ao SDK/HTTP da Brevo.

A infraestrutura de filas BullMQ já foi especificada e implementada separadamente. Esta spec não cria consumers ou jobs; ela apenas prepara a capacidade síncrona/imperativa de envio que poderá ser usada por workers, use cases ou módulos futuros.

## Escopo

Esta spec cobre:

- criação de um módulo compartilhado de e-mail;
- criação de uma porta de envio independente de provedor;
- criação de um `MailService` como fachada de aplicação/plataforma;
- criação de adapter Brevo API como primeira implementação;
- desenho para adapters futuros, como SMTP;
- configuração centralizada de provedor e credenciais;
- DTOs internos de envio de e-mail;
- mapeamento de erros de provedor para erros próprios da plataforma;
- testes unitários do `MailService`, configuração e adapter;
- documentação técnica de uso por módulos futuros.

## Fora De Escopo

Esta spec não cobre:

- criação de módulo `notifications`;
- criação de fila BullMQ;
- criação de consumer, worker ou processor;
- criação de templates reais de e-mail;
- envio de e-mail de boas-vindas;
- alteração de fluxos de autenticação;
- endpoint HTTP para envio de e-mail;
- persistência de logs/auditoria de e-mail em banco;
- webhooks de delivery, bounce, open ou click;
- gestão de unsubscribe/preferências de comunicação.

## Regras

- Módulos de domínio não devem importar SDKs ou clientes HTTP da Brevo.
- Use cases e handlers futuros devem depender de `MailService` ou de uma porta própria, nunca do adapter Brevo diretamente.
- O adapter Brevo deve ficar na infraestrutura compartilhada.
- Dados sensíveis, como API key, devem vir de configuração e nunca aparecer em logs.
- Payloads de envio devem aceitar destinatários, assunto, remetente opcional, template opcional, HTML opcional, texto opcional e variáveis de template.
- O contrato interno deve ser genérico o suficiente para suportar Brevo API e SMTP.
- O serviço deve validar que existe conteúdo mínimo para envio: template, HTML ou texto.
- Falhas do provedor devem ser traduzidas para erro próprio de plataforma, sem expor resposta bruta do provedor para camadas superiores.
- A implementação inicial deve permitir desabilitar envio real em ambiente de teste.

## Requisitos Funcionais

### REQ-001 - Expor MailService

WHEN um módulo futuro precisar enviar e-mail
THE SYSTEM SHALL disponibilizar um `MailService` injetável.

### REQ-002 - Esconder provedor concreto

WHEN um módulo futuro chamar `MailService`
THE SYSTEM SHALL NOT exigir import de Brevo, SMTP ou SDK concreto.

### REQ-003 - Usar Brevo API como adapter inicial

WHEN o provedor configurado for `brevo`
THE SYSTEM SHALL enviar e-mails transacionais por meio da API da Brevo.

### REQ-004 - Permitir troca de provedor

WHEN o provedor configurado mudar para outro adapter suportado
THE SYSTEM SHALL manter o contrato público do `MailService`.

### REQ-005 - Validar payload mínimo

WHEN uma solicitação de envio não tiver destinatário, assunto ou conteúdo
THE SYSTEM SHALL falhar antes de chamar o provedor externo.

### REQ-006 - Mapear erros do provedor

WHEN o provedor externo falhar
THE SYSTEM SHALL lançar erro próprio da plataforma com código estável e mensagem segura.

### REQ-007 - Proteger segredos

WHEN ocorrer erro ou log operacional
THE SYSTEM SHALL NOT registrar API key, headers de autorização ou payload sensível completo.

### REQ-008 - Não criar consumers

WHEN esta spec for implementada
THE SYSTEM SHALL NOT criar fila, worker, processor, subscriber de evento ou consumer.

## Edge Cases

- IF `MAIL_PROVIDER=brevo` e `BREVO_API_KEY` estiver ausente
THEN o boot deve falhar com erro claro de configuração.

- IF `MAIL_ENABLED=false`
THEN o serviço deve operar em modo no-op controlado, retornando resultado seguro sem chamar provedor externo.

- IF o provider retornar erro temporário
THEN o adapter deve sinalizar erro retentável para que um worker futuro possa decidir retry.

- IF o provider retornar erro permanente de payload
THEN o adapter deve sinalizar erro não retentável.

- IF múltiplos destinatários forem enviados
THEN o contrato deve preservar a lista, sem duplicar chamadas por padrão.

- IF template e HTML forem enviados juntos
THEN a regra de precedência deve ser documentada no design.

## Critérios De Aceite

- Existe spec completa com requirements, design, tasks e decisions.
- A spec não cria consumer, fila ou módulo `notifications`.
- O design define `MailService`, porta de provider e adapter Brevo.
- O design define configuração por ambiente e validação.
- O design define erro próprio para falhas de e-mail.
- O design deixa claro como trocar Brevo por SMTP ou outro provider.
- As tasks cobrem código, documentação e testes da estrutura de e-mail.
