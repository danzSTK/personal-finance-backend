---
area: notifications
feature: email-template-registry
type: spec-requirements
status: current
related:
  - ../../../../notifications/README.md
  - ../../../../notifications/email-templates/README.md
  - ../../../../platform/email-provider.md
  - ../../../../database/schema.md
  - ../../../../configuration.md
  - ../../../../auth/change-password/notifications.md
---

# Requirements - Email Template Registry

## Objetivo

Desacoplar as intenções de e-mail e os consumidores de notifications dos
identificadores de template da Brevo, substituindo números externos por um
contrato lógico, tipado e versionado.

O backend deve se tornar a fonte oficial dos contratos e dos arquivos HTML dos
templates. Somente a infraestrutura do provider pode traduzir a combinação
`templateKey + templateVersion` para um identificador externo.

## Contexto Atual

O fluxo atual já persiste intenções em `email_messages`, usa BullMQ e executa o
envio no worker. Entretanto, a separação de provider está incompleta:

- `email_messages` persiste `template_key` e `provider_template_id`;
- o domínio declara `BrevoTemplateId`;
- casos de uso conhecem `EmailProviderKey.BREVO` e IDs externos;
- `SendEmailMessageUseCase` converte o ID persistido para número;
- o contrato compartilhado de mail expõe `templateId` aos consumidores;
- a documentação oficial registra números da Brevo como parte do template;
- os HTMLs atuais vivem no repositório do frontend, apesar de seus parâmetros
  serem produzidos e validados pelo backend.

Os templates existentes são:

| Chave lógica         | Versão inicial | Parâmetros obrigatórios                                                              |
| -------------------- | -------------- | ------------------------------------------------------------------------------------ |
| `welcome-email`      | `1`            | `first_name`, `dashboard_url`, `support_url`, `support_url_label`, `preferences_url` |
| `email-verification` | `1`            | `first_name`, `verification_url`, `expires_in_minutes`, `support_url`                |

## Escopo

Esta spec cobre:

- catálogo lógico e versionado de templates;
- tipagem estática dos parâmetros por template e versão;
- validação runtime dos parâmetros antes da persistência e antes do envio;
- resolução de IDs externos apenas na infraestrutura do provider;
- configuração dos IDs Brevo por variável de ambiente, sem defaults numéricos;
- adequação de `MailService`, portas e adapters ao template lógico;
- migration direta e transacional de `email_messages`;
- migração dos registros já existentes para `template_version = 1`;
- migração dos HTMLs atuais do repositório frontend para o backend;
- validação automatizada entre placeholders do HTML e contrato declarado;
- documentação oficial do modelo, versionamento, configuração e templates;
- criação da skill de repositório `email-template-constructor`;
- atualização das specs e documentos anteriores que registram o modelo antigo.

## Fora De Escopo

Esta spec não cobre:

- criação dos templates `password-changed` e `password-change-blocked`;
- handlers dos eventos de alteração de senha;
- mudança dos eventos ou regras de negócio de auth;
- sincronização automática, criação ou publicação de templates pela API da Brevo;
- renderização do HTML no backend;
- adoção de MJML, React Email ou outro compilador;
- webhooks de delivery, bounce, abertura ou clique;
- tabela detalhada de tentativas de entrega;
- endpoint administrativo para editar templates;
- gestão de traduções ou múltiplos idiomas;
- correção do armazenamento do token de verificação presente em
  `verification_url`, que exige uma decisão de segurança própria antes da
  produção.

## Regras Gerais

- Chaves de template são identificadores lógicos estáveis e independentes de
  provider.
- O padrão textual existente com hífen deve ser preservado, como
  `welcome-email` e `email-verification`.
- Toda intenção deve persistir `template_key`, `template_version` e
  `template_params`.
- Nenhuma intenção nova deve persistir `provider_template_id`.
- Casos de uso, handlers, entidades e eventos não podem conhecer IDs da Brevo.
- A combinação `template_key + template_version` identifica um contrato
  imutável de conteúdo e parâmetros.
- Uma versão publicada não pode ser alterada de forma incompatível.
- Mudanças no HTML, assunto, semântica ou parâmetros que afetem a mensagem
  entregue devem criar uma nova versão.
- `template_params` deve ser um objeto JSON estrito: campos obrigatórios devem
  existir, tipos devem corresponder e campos desconhecidos devem ser rejeitados.
- Tipagem TypeScript não substitui validação runtime de dados reconstituídos do
  PostgreSQL.
- A validação deve ocorrer ao criar a intenção e novamente no worker antes da
  chamada externa.
- Parâmetros e HTML não podem ser registrados integralmente em logs de erro.
- O job BullMQ continua carregando somente `emailMessageId`.
- A idempotência continua sendo definida pelo fato de negócio, não pela versão
  do template.
- Uma intenção já existente mantém a versão com a qual foi criada, mesmo após
  uma versão mais nova se tornar ativa.
- O provider `noop` deve validar o contrato lógico sem exigir um ID Brevo.

## Requisitos Funcionais

### REQ-001 - Identificar templates por chave lógica

WHEN um handler ou caso de uso criar uma intenção de e-mail
THE SYSTEM SHALL exigir uma `template_key` pertencente ao catálogo lógico.

### REQ-002 - Versionar o contrato

WHEN uma intenção de e-mail for criada
THE SYSTEM SHALL persistir uma `template_version` inteira e positiva.

### REQ-003 - Tipar parâmetros por template

WHEN código TypeScript construir parâmetros para um template conhecido
THE SYSTEM SHALL restringir os campos e tipos de acordo com a chave e a versão.

### REQ-004 - Validar parâmetros antes de persistir

WHEN uma nova intenção for criada
THE SYSTEM SHALL validar `template_params` pelo schema correspondente antes de
salvar `email_messages`.

### REQ-005 - Revalidar no worker

WHEN o worker carregar uma intenção do PostgreSQL
THE SYSTEM SHALL revalidar chave, versão e parâmetros antes de chamar o provider.

### REQ-006 - Rejeitar contrato desconhecido

IF a chave não existir ou a versão não for suportada
THEN a mensagem deve falhar permanentemente com código estável e sem chamada ao
provider.

### REQ-007 - Rejeitar parâmetros inválidos

IF parâmetros obrigatórios estiverem ausentes, tiverem tipo incorreto ou
contiverem campos desconhecidos
THEN a mensagem deve falhar permanentemente com código estável e diagnóstico
sanitizado.

### REQ-008 - Esconder IDs externos

WHEN um consumidor solicitar o envio de um template
THE SYSTEM SHALL receber somente chave lógica, versão, destinatário e parâmetros.

### REQ-009 - Resolver o ID na infraestrutura

WHEN o provider ativo for Brevo
THE SYSTEM SHALL traduzir `template_key + template_version` para um inteiro
positivo somente no limite da infraestrutura Brevo.

### REQ-010 - Falhar sem mapping Brevo

IF o provider ativo for Brevo e não existir mapping para a chave e versão
THEN o envio deve falhar como erro de configuração não retentável, sem chamar a
Brevo.

### REQ-011 - Configurar IDs por ambiente

WHEN o worker iniciar com mail real e provider Brevo
THE SYSTEM SHALL obter os IDs das versões ativas por variáveis de ambiente e
validá-los como inteiros positivos.

### REQ-012 - Migrar intenções existentes

WHEN a migration direta for executada
THE SYSTEM SHALL atribuir `template_version = 1` a todas as intenções existentes
dos templates `welcome-email` e `email-verification`.

### REQ-013 - Validar ausência de estado incompatível

WHEN a migration for executada
THE SYSTEM SHALL validar as chaves existentes antes de remover o identificador
externo, abortando a transação diante de um estado desconhecido.

### REQ-014 - Remover o ID persistido na mesma migration

WHEN a migration desta feature concluir
THE SYSTEM SHALL remover `provider_template_id` no mesmo passo transacional do
backfill de versão.

### REQ-015 - Registrar provider como resultado

WHEN o provider aceitar o envio
THE SYSTEM SHALL registrar o provider efetivamente utilizado e o
`provider_message_id`, quando retornado, como resultado operacional, não como
parte da intenção original.

### REQ-016 - Migrar HTMLs para o backend

WHEN esta feature for concluída
THE SYSTEM SHALL manter os HTMLs oficiais de `welcome-email:v1` e
`email-verification:v1` no repositório backend e removê-los da documentação do
frontend.

### REQ-017 - Validar placeholders

WHEN um HTML de template for validado
THE SYSTEM SHALL comparar todos os placeholders `params.*` com o contrato da
mesma chave e versão.

### REQ-018 - Documentar cada template

WHEN um template for registrado
THE SYSTEM SHALL documentar chave, versão, finalidade, trigger, idempotência,
parâmetros, origem, sensibilidade, caminho do HTML e variável de mapping do
provider.

### REQ-019 - Não publicar IDs na documentação de domínio

WHEN a documentação de notifications ou auth mencionar um template
THE SYSTEM SHALL usar chave e versão, sem registrar números concretos da Brevo.

### REQ-020 - Padronizar construção de templates

WHEN a skill `email-template-constructor` for criada
THE SYSTEM SHALL exigir o design system Danfy, o contrato registrado, a criação
de versão e a validação automatizada antes de considerar um HTML concluído.

## Fluxos

### Criação da intenção

```text
evento ou caso de uso
  -> escolhe templateKey + templateVersion
  -> monta params tipados
  -> valida contrato runtime
  -> persiste email_messages
  -> enfileira somente emailMessageId
```

### Envio

```text
job BullMQ
  -> carrega email_messages
  -> revalida key + version + params
  -> MailService recebe referência lógica
  -> adapter ativo resolve referência externa
  -> Brevo recebe templateId + params + tags
  -> email_messages registra resultado
```

## Migração Dos Templates Atuais

### `welcome-email:v1`

O HTML atualmente localizado em
`personal-finance-frontend/docs/email-templates/danfy-welcome-email.html` deve
ser transferido para o diretório canônico do backend.

Placeholders esperados:

- `params.first_name`;
- `params.dashboard_url`;
- `params.support_url`;
- `params.support_url_label`;
- `params.preferences_url`.

### `email-verification:v1`

O HTML atualmente localizado em
`personal-finance-frontend/docs/email-templates/danfy-email-verification.html`
deve ser transferido para o diretório canônico do backend.

Placeholders esperados:

- `params.first_name`;
- `params.verification_url`;
- `params.expires_in_minutes`;
- `params.support_url`.

A cópia no backend deve ser validada antes da remoção no repositório frontend.
Essa transferência não altera automaticamente o template remoto da Brevo.

## Edge Cases

- IF um registro antigo tiver uma chave diferente das chaves conhecidas
  THEN a migration deve abortar com diagnóstico explícito antes de remover a
  coluna antiga.
- IF aparecer uma mensagem não terminal durante a validação pré-implantação
  THEN a implantação deve ser interrompida e replanejada antes da migration.
- IF uma intenção antiga já estiver em estado terminal
  THEN ela não precisa de mapping para ser apenas consultada.
- IF o provider configurado for `noop`
  THEN nenhuma variável `BREVO_TEMPLATE_*_ID` deve ser obrigatória.
- IF a validação runtime falhar
  THEN valores de parâmetros não devem aparecer no erro persistido ou no log.
- IF o HTML usar um placeholder não declarado
  THEN a validação de templates deve falhar.
- IF o contrato declarar um parâmetro nunca usado no HTML
  THEN a validação deve falhar, salvo parâmetro explicitamente marcado como
  permitido para assunto ou configuração externa.
- IF uma mudança de conteúdo for necessária após a publicação
  THEN deve ser criado um novo diretório `vN` e um novo mapping externo.
- IF o mesmo evento for republicado após uma nova versão ficar ativa
  THEN a intenção já existente deve manter sua versão original.
- IF `verification_url` contiver token de uso único
  THEN o valor não pode aparecer em logs; o risco de persistência em JSONB deve
  permanecer documentado até uma spec de proteção de segredo resolver o tema.

## Critérios De Aceite

- Existem `requirements.md`, `design.md`, `tasks.md` e `decisions.md` aprovados.
- Domínio e aplicação não declaram `BrevoTemplateId` nem IDs numéricos externos.
- `email_messages` possui `template_version` inteiro positivo.
- `provider_template_id` é removido pela migration direta.
- A intenção não seleciona provider durante sua criação.
- Os dois templates atuais são migrados para `v1`, e a migration aborta sem
  alterar o schema se encontrar mensagens reenfileiráveis.
- Os IDs Brevo vêm exclusivamente de configuração de infraestrutura.
- Chave, versão e parâmetros são validados antes da persistência e do envio.
- Parâmetros inválidos ou mapping ausente produzem falha permanente segura.
- Os HTMLs canônicos vivem no backend e não permanecem duplicados no frontend.
- Existe validação entre placeholders HTML e o contrato registrado.
- A skill de repositório segue o design system e executa a validação obrigatória.
- A documentação de notifications, mail, configuração, banco, auth e templates
  reflete o novo modelo sem números concretos da Brevo.
- Testes cobrem contratos, migration, mappings, worker, noop e compatibilidade das
  intenções existentes.
