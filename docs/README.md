---
area: documentation
type: index
status: current
last_reviewed: 2026-07-23
---

# Documentação técnica

Esta é a entrada principal para a documentação do Danfy Backend. O índice separa arquitetura, domínios, contratos HTTP, plataforma, operação e especificações sem exigir busca manual pelo repositório.

## Como navegar

| Necessidade | Ponto de entrada |
| --- | --- |
| Preparar o ambiente local | [Desenvolvimento local](./getting-started.md) |
| Entender componentes e dependências | [Arquitetura e organização do código](./architecture.md) |
| Consultar regras de negócio | [Documentação por domínio](#domínios) |
| Integrar um cliente HTTP | [Guia de integrações](./integrations/README.md) |
| Operar API, worker, filas ou deploy | [Operação](#operação) |
| Entender capacidades transversais | [Plataforma](#plataforma) |
| Revisar requisitos e decisões de uma mudança | [Especificações técnicas](./specs/README.md) |
| Consultar contratos HTTP publicados | [Swagger/OpenAPI](https://api.danfy.app/docs) |

## Primeiros passos

- [Desenvolvimento local](./getting-started.md): do clone à inicialização da API e do worker.
- [Configuração por variáveis de ambiente](./configuration.md): obrigatoriedade, defaults e separação entre API e worker.
- [Comandos principais](./commands.md): build, qualidade, testes, migrations, Docker e health checks.
- [Arquitetura e organização do código](./architecture.md): camadas, dependências, processos e padrões para contribuições.
- [Documentação pública da API](https://api.danfy.app/docs): contratos HTTP em Swagger/OpenAPI.

## Arquitetura

- [Arquitetura e organização do código](./architecture.md)
- [Schema atual do PostgreSQL](./database/schema.md)
- [Arquitetura de eventos e outbox](./events/README.md)
- [Infraestrutura de filas](./platform/queue-infrastructure.md)
- [Datas civis e instantes](./platform/dates-and-times.md)

## Plataforma

- [Mapa da plataforma](./platform/README.md)
- [Objetos de resposta](./platform/response-objects.md)
- [Email provider](./platform/email-provider.md)
- [Padrões de issues](./platform/issue-standards.md)

## Operação

- [Desenvolvimento local](./getting-started.md)
- [Configuração por variáveis de ambiente](./configuration.md)
- [Comandos principais](./commands.md)
- [Guia de deploy na VPS](./deploy.md)
- [Operação do worker](./platform/worker-operations.md)
- [Infraestrutura de filas](./platform/queue-infrastructure.md)
- [Integração contínua](./platform/continuous-integration.md)
- [Atualizações de dependências](./platform/dependency-updates.md)
- [Releases e entrega contínua](./platform/continuous-delivery.md)

## Domínios

- [Accounts](./accounts/README.md)
- [Assets](./assets/README.md)
- [Auth](./auth/README.md)
- [Categories](./categories/README.md)
- [Notifications](./notifications/README.md)
- [Transactions](./transactions/README.md)
- [Users](./users/README.md)

Cada índice de domínio separa conceitos, fluxos, decisões e referências. Os contratos destinados ao frontend ficam em [Integrações](./integrations/README.md), evitando misturar regra de negócio com exemplos de consumo HTTP.

## Dados e integrações

- [Banco de dados](./database/README.md)
- [Schema atual](./database/schema.md)
- [Mapa de eventos](./events/README.md)
- [Integrações entre módulos](./integrations/README.md)
- [Storage](./storage/README.md)

## Especificações

As mudanças relevantes são descritas em `docs/specs/<módulo>/<feature>/specs/`:

```text
requirements.md  requisitos e critérios de aceite
design.md        desenho técnico e fluxo de dados
tasks.md         plano e estado da implementação
decisions.md     decisões, alternativas e trade-offs
```

A pasta completa está em [Especificações técnicas](./specs/).

Specs registram a evolução de uma mudança e podem permanecer como histórico depois da implementação. Quando uma spec divergir de um documento `current` ou do comportamento executável, use o documento atual e o código como referência e abra uma correção para o desvio.

## Estados dos documentos

Todo documento principal deve declarar `status` no front matter YAML:

| Estado | Significado |
| --- | --- |
| `draft` | proposta ou estudo ainda não consolidado; não representa o comportamento vigente |
| `current` | fonte de referência atual, alinhada ao comportamento conhecido |
| `historical` | registro útil de uma decisão, implementação ou contexto já concluído ou substituído |
| `deprecated` | conteúdo mantido apenas para redirecionamento ou contexto; não deve orientar novas mudanças |
| `open` | pergunta ou decisão explicitamente ainda não resolvida |

Use `last_reviewed: YYYY-MM-DD` em índices, guias operacionais e documentos cujo alinhamento com produção precise ser verificável. Quando um documento for substituído, adicione `superseded_by` com links para as fontes atuais.

Documentos de estudo devem usar um `type` como `study`, `design` ou `specification`. Runbooks, referências e guias operacionais usam `type: runbook`, `reference` ou `guide`. O `type` explica a finalidade; o `status` informa se o conteúdo continua vigente.

## Histórico e estudos

Estes documentos preservam contexto, mas não são fontes operacionais atuais:

- [Migração do access token para cookie HttpOnly](./design.md)
- [Auth v1](./auth/auth.v1.md)
- [Auth v2](./auth/auth.v2.md)
- [Estudo inicial de Object Storage](./storage/Dados%20iniciais%20%28manuais%29.md)

## Comunidade, segurança e licença

- [Política de participação e contribuições](../CONTRIBUTING.md)
- [Canais de suporte](../SUPPORT.md)
- [Código de Conduta](../CODE_OF_CONDUCT.md)
- [Política de segurança](../SECURITY.md)
- [PolyForm Strict License 1.0.0](../LICENSE)
- [Diretrizes de uso da marca Danfy](../TRADEMARKS.md)

## Como manter esta documentação

- atualize o documento junto da alteração que muda seu comportamento;
- prefira links relativos entre arquivos do repositório;
- mantenha exemplos de comandos executáveis e sem secrets;
- use apenas os estados padronizados definidos neste índice;
- marque conteúdo substituído com `historical` ou `deprecated` e informe `superseded_by`;
- diferencie documentação operacional, especificação e material de estudo pelo campo `type`;
- trate specs como histórico das decisões e guias como descrição operacional vigente.
