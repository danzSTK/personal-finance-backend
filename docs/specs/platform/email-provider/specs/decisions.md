---
area: platform
feature: email-provider
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions - Email Provider

## DEC-001 - Criar infraestrutura em shared/mail

Status: accepted

Decision:
A base de envio de e-mails ficará em `api/src/shared/mail`.

Reason:
Envio de e-mail é uma capacidade transversal. O módulo `notifications` poderá usar essa infraestrutura futuramente, mas não deve ser criado apenas para hospedar detalhes de provider.

Impact:
O código de provider fica isolado da camada de domínio e de módulos de negócio.

## DEC-002 - Expor MailService como fachada

Status: accepted

Decision:
Módulos futuros usarão `MailService` para solicitar envio de e-mails.

Reason:
Uma fachada simples reduz acoplamento e centraliza validação, remetente padrão e tradução de erros.

Impact:
Trocar Brevo por outro provider exige alterar binding/adapter, não os consumidores.

## DEC-003 - Usar Brevo API como primeiro adapter

Status: accepted

Decision:
A primeira implementação real será `BrevoMailProvider`, chamando a API transacional da Brevo.

Reason:
O objetivo atual é consumir a API da Brevo, mas mantendo o contrato interno genérico.

Impact:
Credenciais e detalhes HTTP ficam restritos ao adapter Brevo.

## DEC-004 - Usar SDK oficial da Brevo no adapter

Status: accepted

Decision:
O adapter Brevo deve usar o SDK `@getbrevo/brevo`.

Reason:
O SDK oficial encapsula detalhes da API transacional da Brevo e deve ficar restrito ao adapter, preservando a interface interna.

Impact:
`@getbrevo/brevo` entra como dependência runtime, mas seus tipos não vazam para `MailService` nem para a porta `MailProvider`.

## DEC-005 - Criar NoopMailProvider

Status: accepted

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

## DEC-007 - Usar Axios em futuras integrações HTTP externas

Status: accepted

Decision:
Para futuras integrações HTTP externas sem SDK adequado, o padrão será usar Axios.

Reason:
Axios oferece interceptors, timeouts e tratamento consistente de erro para integrações HTTP. Nesta spec ele não é necessário porque Brevo será acessado pelo SDK oficial.

Impact:
Axios não será instalado agora. Se um adapter futuro precisar de HTTP direto, a spec dessa integração deve adicionar a dependência.

## DEC-008 - Não implementar SMTP nesta spec

Status: accepted

Decision:
Não haverá adapter SMTP nesta implementação.

Reason:
O objetivo atual é envio via API/SDK. A arquitetura já permite trocar o provider por outro adapter no futuro sem alterar consumidores.

Impact:
`MAIL_PROVIDER` aceita apenas `brevo` e `noop` nesta etapa.
