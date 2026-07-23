---
area: documentation
type: index
status: current
---

# Documentação técnica

Esta pasta reúne arquitetura, execução local, operação, contratos internos, decisões e especificações do Danfy Backend.

## Primeiros passos

- [Desenvolvimento local](./getting-started.md): do clone à inicialização da API e do worker.
- [Configuração por variáveis de ambiente](./configuration.md): obrigatoriedade, defaults e separação entre API e worker.
- [Comandos principais](./commands.md): build, qualidade, testes, migrations, Docker e health checks.
- [Arquitetura e organização do código](./architecture.md): camadas, dependências, processos e padrões para contribuições.
- [Documentação pública da API](https://api.danfy.app/docs): contratos HTTP em Swagger/OpenAPI.

## Plataforma e operação

- [Mapa da plataforma](./platform/README.md)
- [Integração contínua](./platform/continuous-integration.md)
- [Atualizações de dependências](./platform/dependency-updates.md)
- [Releases e entrega contínua](./platform/continuous-delivery.md)
- [Guia de deploy na VPS](./deploy.md)
- [Operação do worker](./platform/worker-operations.md)
- [Infraestrutura de filas](./platform/queue-infrastructure.md)
- [Datas e instantes](./platform/dates-and-times.md)
- [Objetos de resposta](./platform/response-objects.md)

## Domínios

- [Accounts](./accounts/README.md)
- [Assets](./assets/README.md)
- [Auth](./auth/README.md)
- [Categories](./categories/README.md)
- [Notifications](./notifications/README.md)
- [Transactions](./transactions/README.md)
- [Users](./users/README.md)

## Dados, eventos e integrações

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
- diferencie o estado atual de planos futuros;
- trate specs como histórico das decisões e guias como descrição operacional vigente.
