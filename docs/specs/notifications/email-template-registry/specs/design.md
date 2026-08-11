---
area: notifications
feature: email-template-registry
type: spec-design
status: current
related:
  - ./requirements.md
  - ./decisions.md
  - ../../../../notifications/README.md
  - ../../../../notifications/email-templates/README.md
  - ../../../../platform/email-provider.md
  - ../../../../database/schema.md
---

# Design - Email Template Registry

## Visão Geral

A aplicação continuará usando PostgreSQL como fonte das intenções, BullMQ como
transporte assíncrono e `MailService` como fachada. A mudança introduz uma
referência lógica entre notifications e mail:

```text
EmailTemplateReference = templateKey + templateVersion
```

O provider recebe essa referência e resolve seu identificador externo no limite
da infraestrutura. Nenhuma camada anterior recebe ou persiste o número da Brevo.

## Arquitetura

```text
evento de domínio
  -> handler de notifications
  -> Create*EmailMessageUseCase
      -> EmailTemplateContractRegistry
      -> EmailMessageRepository (PostgreSQL)
      -> EmailJobQueueProducer (BullMQ)
  -> EmailMessageProcessor
  -> SendEmailMessageUseCase
      -> EmailTemplateContractRegistry
      -> MailService
          -> MailProvider
              -> NoopMailProvider
              -> BrevoMailProvider
                  -> BrevoTemplateResolver
                  -> SDK Brevo
```

## Separação Por Camada

### Notifications domain

Responsável por:

- chaves lógicas;
- versões suportadas;
- mapa TypeScript de parâmetros;
- referência lógica de template;
- estado da intenção `EmailMessage`.

Não conhece Brevo, IDs externos, variáveis de ambiente, Zod, BullMQ ou SDK.

Estrutura prevista:

```text
api/src/modules/notifications/domain/templates/
└── email-template.contract.ts
```

### Notifications application

Responsável por:

- schemas Zod estritos;
- registro de contratos por chave e versão;
- validação na criação e no envio;
- tradução de falhas de contrato para resultado permanente da intenção;
- escolha da versão ativa ao criar uma nova intenção.

Estrutura prevista:

```text
api/src/modules/notifications/application/templates/
└── email-template-contract.registry.ts

api/src/modules/notifications/application/errors/
└── email-template-contract.error.ts
```

### Shared mail

Responsável por:

- contrato de transporte independente do provider;
- remetente padrão;
- seleção do provider;
- erros seguros e classificação retentável;
- tradução da referência lógica no adapter concreto.

`SendMailInput` deixa de expor `templateId` aos consumidores e passa a aceitar
uma referência opaca composta por chave e versão. O contrato continua aceitando
HTML/texto para envios não baseados em template.

### Brevo infrastructure

Responsável por:

- mapping `templateKey + templateVersion -> templateId`;
- validação defensiva do mapping;
- tradução para `Brevo.SendTransacEmailRequest`;
- envio de `templateId`, `params`, tags e headers;
- mapeamento de erros do SDK.

O adapter é a única parte autorizada a manipular o número do template.

## Modelo Lógico

As chaves iniciais permanecem:

```text
welcome-email
email-verification
```

O modelo TypeScript deve permitir uma relação equivalente a:

```text
EmailTemplateParamsMap
  welcome-email:v1      -> WelcomeEmailV1Params
  email-verification:v1 -> EmailVerificationV1Params
```

Uma solicitação tipada deve relacionar a referência ao payload, impedindo que
parâmetros de um template sejam enviados para outro durante compilação.

O tipo genérico melhora a autoria do código, mas a entidade persistida continua
expondo `templateParams` como objeto somente leitura após reconstituição. O
registro de aplicação recupera a segurança de tipos pela validação runtime.

## Catálogo E Versionamento

Cada definição runtime informa:

- chave;
- versão;
- schema runtime;
- nomes exatos dos parâmetros usados para validar o HTML.

A versão ativa para novas intenções fica no contrato TypeScript. Sensibilidade,
caminho canônico, compatibilidade e estado operacional ficam na documentação da
chave, sem criar um segundo catálogo executável.

Regras de versão:

- versões começam em `1`;
- versões são inteiros positivos;
- uma versão publicada é imutável;
- uma versão retirada continua registrada enquanto houver mensagens
  reenfileiráveis;
- alterar conteúdo entregue, placeholders, assunto ou semântica cria nova
  versão;
- a versão ativa é escolhida somente na criação da intenção;
- retry e replay idempotente preservam a versão persistida.

Não será criada uma tabela `email_templates`. O catálogo faz parte do código
versionado e deve mudar no mesmo deploy dos contratos e mappings.

## Contratos Iniciais

### `welcome-email:v1`

```text
first_name: string não vazia
dashboard_url: URL HTTP(S) absoluta
support_url: URL HTTP(S) absoluta
support_url_label: string não vazia
preferences_url: URL HTTP(S) absoluta
```

### `email-verification:v1`

```text
first_name: string não vazia
verification_url: URL HTTP(S) absoluta
expires_in_minutes: inteiro positivo
support_url: URL HTTP(S) absoluta
```

Os schemas devem ser estritos. Eles não devem normalizar silenciosamente um
contrato incorreto recuperado do banco.

## Validação

### Antes da persistência

O caso de uso monta os parâmetros tipados e chama o registro. Uma falha impede a
criação de `email_messages` e o enqueue.

### Antes do provider

`SendEmailMessageUseCase` revalida o objeto JSONB. Essa validação protege contra:

- registros antigos incompatíveis;
- alteração manual no banco;
- bugs de mapper;
- mudança indevida de contrato;
- dados criados por versões anteriores da aplicação.

### Validação do HTML

Um comando determinístico deve:

1. localizar cada diretório `<template-key>/v<version>`;
2. extrair placeholders no formato `params.<nome>`;
3. comparar os placeholders com o contrato registrado;
4. rejeitar placeholder desconhecido;
5. rejeitar parâmetro de corpo não utilizado;
6. verificar estrutura mínima, preheader, idioma, título, texto alternativo e
   links;
7. rejeitar scripts, formulários e recursos locais;
8. emitir saída sem valores sensíveis.

O comando deve ser executável por npm e usado pela skill e pela CI.

## Erros

Erros de contrato são internos e não alteram o contrato HTTP.

Códigos estáveis previstos:

```text
EMAIL_TEMPLATE_UNKNOWN
EMAIL_TEMPLATE_VERSION_UNSUPPORTED
EMAIL_TEMPLATE_PARAMS_INVALID
MAIL_TEMPLATE_MAPPING_MISSING
```

Os três primeiros pertencem ao contexto de notifications. O último representa
configuração ausente no limite do provider.

Todos são não retentáveis para a mesma intenção. `SendEmailMessageUseCase` deve:

1. marcar `FAILED_PERMANENT`;
2. incrementar `attempts_count` uma única vez por tentativa;
3. persistir código e mensagem sanitizada;
4. não chamar a Brevo;
5. permitir log operacional com id, chave e versão, nunca com os params.

Falhas de rede e indisponibilidade da Brevo continuam seguindo a classificação
retentável já existente em `MailError`.

## Contrato De Mail

O contrato conceitual para template deve carregar:

```text
to
from/replyTo opcionais
template.key
template.version
params
tags
metadata
```

O contrato de HTML/texto livre permanece disponível para outros consumidores,
mas `template` e `templateId` externo não podem coexistir na API pública.

O adapter Brevo monta:

```text
templateId: resolved(template.key, template.version)
params: input.params
tags: template key + email type + template version
headers: metadata sanitizada
```

## Configuração Brevo

Os mappings iniciais devem ficar no namespace de mail/Brevo:

```text
BREVO_TEMPLATE_WELCOME_EMAIL_V1_ID
BREVO_TEMPLATE_EMAIL_VERIFICATION_V1_ID
```

Regras:

- não há default numérico no código;
- o valor deve ser inteiro positivo;
- é obrigatório somente no worker quando `MAIL_ENABLED=true` e
  `MAIL_PROVIDER=brevo`;
- API e provider `noop` não exigem esses valores;
- `NOTIFICATIONS_EMAIL_VERIFICATION_PROVIDER_TEMPLATE_ID` deve ser removida;
- versões futuras recebem variável própria;
- mappings antigos não podem ser removidos enquanto houver mensagem
  reenfileirável naquela versão.

O config tipado deve produzir um mapa imutável. A resolução ausente falha antes
do SDK.

## Persistência

### Estado final de `email_messages`

Campos afetados:

| Coluna                 | Estado final                     | Responsabilidade                          |
| ---------------------- | -------------------------------- | ----------------------------------------- |
| `template_key`         | mantida, `varchar(100) not null` | chave lógica independente do provider     |
| `template_version`     | nova, `integer not null`         | versão imutável do contrato               |
| `template_params`      | mantida, `jsonb not null`        | parâmetros validados da intenção          |
| `provider_template_id` | removida                         | detalhe externo resolvido no envio        |
| `provider`             | nullable                         | provider que efetivamente aceitou o envio |
| `provider_message_id`  | mantida, nullable                | identificador retornado no aceite         |

Adicionar constraint:

```text
CHK_email_messages_template_version
template_version >= 1
```

Não adicionar FK ou CHECK enumerando chaves: isso exigiria migration para cada
novo template e duplicaria o catálogo de código.

### Migration direta

Não existem jobs pendentes nem necessidade de sobreposição com workers antigos
no ambiente atual. A migration pode executar a alteração completa dentro da
mesma transação:

1. bloquear alterações concorrentes na tabela durante a mudança de contrato;
2. validar que todas as chaves existentes são `welcome-email` ou
   `email-verification`;
3. validar que não existem mensagens em estado `PENDING`, `PROCESSING` ou
   `FAILED_RETRYABLE`;
4. adicionar `template_version` com backfill `1`;
5. definir `template_version` como `NOT NULL`;
6. adicionar `CHK_email_messages_template_version`;
7. tornar `provider` nullable;
8. preservar o `provider` de mensagens `SENT` e limpar o valor legado das
   mensagens que não foram aceitas pelo provider;
9. remover `provider_template_id`;
10. atualizar `docs/database/schema.md` no mesmo commit.

Se a premissa de ausência de backlog não for verdadeira no momento da execução,
a migration deve abortar e a estratégia expand-contract deve ser reavaliada.

### Dados existentes

Mapeamento de backfill:

| `template_key` atual | `template_version` |
| -------------------- | ------------------ |
| `welcome-email`      | `1`                |
| `email-verification` | `1`                |

Mensagens `SENT` preservam o provider que efetivamente aceitou o envio.
Mensagens `FAILED_PERMANENT` recebem `provider = NULL`, pois o valor legado
representava intenção. Estados, idempotência, timestamps, destinatário, params e
`provider_message_id` não devem ser modificados.

## HTML Como Fonte Oficial

Estrutura canônica:

```text
api/email-templates/
├── welcome-email/
│   └── v1/
│       └── template.html
└── email-verification/
    └── v1/
        └── template.html
```

Os arquivos continuam sendo HTML puro compatível com clientes de e-mail e com
placeholders Brevo. Eles não são copiados para o bundle da API nem usados para
renderização runtime nesta feature.

Processo de transferência:

1. copiar os dois arquivos do frontend sem alterar seus contratos;
2. validar a lista de placeholders;
3. revisar links, assets remotos, tipografia, light/dark mode e responsividade;
4. registrar a origem e a versão na documentação;
5. commitar a fonte canônica no backend;
6. somente então remover os arquivos do repositório frontend;
7. manter sincronização com a Brevo manual e documentada nesta etapa.

## Skill `email-template-constructor`

A skill será criada em:

```text
.agents/skills/email-template-constructor/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── references/
    └── danfy-email-design-system.md
```

Ela deve ter baixa liberdade visual e exigir:

- consulta ao catálogo e à versão ativa;
- reutilização do shell visual Danfy;
- paleta, tipografia, espaçamento, cantos e componentes aprovados;
- HTML baseado em tabelas e estilos inline quando necessário;
- dark/light mode e layout móvel;
- preheader, título, textos alternativos e links seguros;
- apenas placeholders declarados no contrato;
- nova versão em vez de alteração destrutiva de versão publicada;
- execução do validador antes de concluir;
- atualização da documentação do template.

A skill não deve duplicar documentação auxiliar nem manter uma segunda fonte dos
contratos. Ela referencia o catálogo e o design system oficiais do repositório.
Sua criação deve usar o inicializador e o validador do `skill-creator`.

## Documentação Oficial

Durante a implementação, atualizar:

```text
docs/notifications/README.md
docs/notifications/email-templates/README.md
docs/notifications/email-templates/template-model.md
docs/notifications/email-templates/design-system.md
docs/notifications/email-templates/welcome-email.md
docs/notifications/email-templates/email-verification.md
docs/platform/email-provider.md
docs/configuration.md
docs/database/schema.md
docs/auth/change-password/notifications.md
docs/specs/notifications/welcome-email/specs/*
docs/specs/platform/email-provider/specs/*
docs/specs/auth/email-verification/specs/*
```

Cada documento de template deve declarar com precisão:

- chave e versão;
- status e finalidade;
- evento/trigger;
- chave de idempotência;
- parâmetros e tipos;
- origem dos parâmetros;
- sensibilidade e regras de log;
- caminho do HTML;
- variável de ambiente do mapping, sem seu valor numérico;
- fluxo de publicação manual no provider;
- compatibilidade e histórico de versões.

## Segurança

- IDs externos não são segredos, mas não pertencem ao contrato de domínio.
- API key e mappings não aparecem em logs.
- Parâmetros completos não aparecem em logs ou mensagens de erro.
- URLs devem ser absolutas e usar protocolos permitidos pelo contrato.
- HTML não pode conter script, formulário, iframe ou asset local acidental.
- Links com token são classificados como sensíveis.
- `email-verification:v1` persiste hoje `verification_url`, que contém o token de
  uso único dentro de `template_params`. A documentação deve deixar isso
  explícito; uma spec separada decidirá criptografia, referência indireta ou
  outra proteção antes da produção.

## Observabilidade

Logs estruturados devem permitir correlacionar:

- `emailMessageId`;
- `templateKey`;
- `templateVersion`;
- email type;
- provider selecionado;
- código da falha.

Não registrar destinatário completo, params, HTML ou ID externo do template em
logs comuns.

## Testes

### Domínio

- criação e reconstituição com versão válida;
- rejeição de versão não positiva;
- provider ausente durante intenção pendente;
- gravação do provider como resultado de envio.

### Contratos

- inferência TypeScript por chave e versão;
- schema válido para cada template atual;
- campos ausentes, tipos errados e campos extras;
- chave e versão desconhecidas;
- URLs e inteiros positivos.

### Mail/adapter

- resolução correta por chave e versão;
- mapping ausente sem chamada ao SDK;
- ID inválido no boot/config;
- provider noop sem mapping Brevo;
- payload final enviado ao SDK sem expor ID ao consumidor.

### Use cases e worker

- validação antes de salvar;
- revalidação do JSONB antes de enviar;
- falha permanente de contrato;
- falhas retentáveis do provider preservadas;
- retry usa a versão persistida;
- intenção existente não migra para versão ativa mais nova.

### Persistência e migration

- backfill das duas chaves atuais para versão `1`;
- preservação de status, params e idempotência;
- constraint de versão positiva;
- rejeição de chave desconhecida ou mensagem reenfileirável;
- backfill e remoção da coluna na mesma transação;
- mapper sem `providerTemplateId`.

### Templates

- conjunto exato de placeholders;
- estrutura HTML mínima;
- proibição de elementos inseguros;
- execução do validador para todos os diretórios versionados.

Não realizar chamadas reais para a Brevo nos testes automatizados.

## Impacto Em API, Eventos E Fila

- Nenhum endpoint HTTP ou contrato Swagger muda.
- Nenhum evento de domínio muda nesta feature.
- O payload do job permanece `{ emailMessageId }`.
- A idempotência e o reconciliador permanecem inalterados.
- A futura feature de notificações de alteração de senha apenas registrará novos
  contratos e handlers sobre esta fundação.

## Ordem De Implantação

1. confirmar ausência de mensagens não terminais e parar processos antigos;
2. publicar mappings `v1` no ambiente do worker;
3. executar a migration transacional direta;
4. implantar código que usa chave e versão;
5. validar os envios dos dois templates atuais;
6. publicar HTMLs e documentação canônicos no backend;
7. remover as cópias do frontend;
8. remover configurações e referências legadas.
