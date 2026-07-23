<p align="center">
  <a href="https://app.danfy.app">
    <img
      src=".github/assets/brand/danfy-wordmark-dark.png"
      alt="Danfy"
      width="680"
      height="200"
    />
  </a>
</p>

<h1 align="center">Danfy Finance Backend</h1>

<p align="center">
  Backend da aplicação Danfy Finance que fornece uma API RESTful para gerenciar finanças pessoais de forma simples e eficiente.
</p>

<p align="center">
  <a href="https://app.danfy.app">Aplicação</a>
  ·
  <a href="https://github.com/danzSTK/personal-finance-frontend">Repositório do frontend</a>
  ·
  <a href="https://api.danfy.app/docs">Documentação da API</a>
  ·
  <a href="./docs/">Documentação técnica</a>
  ·
  <a href="https://github.com/danzSTK/personal-finance-backend/issues/new/choose">Reportar um problema</a>
  ·
  <a href="https://github.com/danzSTK/personal-finance-backend/releases">Releases</a>
</p>

<p align="center">
  <a href="https://github.com/danzSTK/personal-finance-backend/actions/workflows/backend-ci.yml">
    <img
      src="https://github.com/danzSTK/personal-finance-backend/actions/workflows/backend-ci.yml/badge.svg"
      alt="Backend CI"
    />
  </a>
  <a href="https://github.com/danzSTK/personal-finance-backend/releases">
    <img
      src="https://img.shields.io/github/v/release/danzSTK/personal-finance-backend?display_name=tag&amp;sort=semver"
      alt="GitHub Release"
    />
  </a>
  <a href="https://nodejs.org/">
    <img
      src="https://img.shields.io/badge/Node.js-22-339933?logo=nodedotjs&amp;logoColor=white"
      alt="Node.js 22"
    />
  </a>
  <a href="./LICENSE">
    <img
      src="https://img.shields.io/badge/licen%C3%A7a-PolyForm%20Strict%201.0.0-2563eb"
      alt="Licença PolyForm Strict 1.0.0"
    />
  </a>
</p>

---

## Sobre o projeto

O Danfy é um projeto de finanças pessoais criado para ajudar, especialmente, pessoas de baixa e média renda a compreender gratuitamente suas movimentações financeiras e tomar decisões mais conscientes sobre o próprio dinheiro.

O projeto nasceu de um problema real: as soluções disponíveis no mercado não atendiam completamente às necessidades que motivaram sua criação. A partir desse desafio, o Danfy tornou-se também uma oportunidade de transformar uma necessidade cotidiana em um produto útil e em um ambiente prático para estudar e aplicar engenharia de software.

A proposta é simples: permitir que cada pessoa entenda o que aconteceu com seu dinheiro ao longo do mês e, considerando sua renda, planeje o mês seguinte com mais clareza. A visão do produto inclui análises e recursos apoiados por inteligência artificial para tornar esse processo mais acessível, objetivo e eficaz.

Além de seu propósito como produto, o Danfy funciona como um laboratório de engenharia de software no qual são estudados e aplicados conceitos como:

- Domain-Driven Design (DDD);
- arquitetura modular;
- processamento assíncrono;
- consistência transacional;
- autenticação e gerenciamento de sessões;
- armazenamento de arquivos e gerenciamento de mídia em nuvem;
- testes automatizados;
- observabilidade;
- entrega contínua;
- deploy seguro e rollback.

Esta é uma versão inicial do produto. Muitas funcionalidades ainda estão em desenvolvimento, mas a infraestrutura principal do backend já está operando em produção.

## Estado atual

O Danfy está em desenvolvimento ativo. A versão pública atual representa a primeira fundação utilizável do backend e reúne os principais fluxos de autenticação, perfil, contas, categorias, transações e notificações.

O planejamento financeiro assistido por inteligência artificial faz parte da visão do produto, mas ainda não compõe uma funcionalidade consolidada da v0.

> A identificação pública do produto é **Danfy v0**, enquanto as versões técnicas do backend seguem versionamento semântico, como `v0.1.3`.

## Funcionalidades disponíveis

### Funcionalidades do produto

#### Acesso e perfil

- cadastro e autenticação com e-mail e senha;
- autenticação com Google OAuth;
- verificação de endereço de e-mail;
- vinculação de provedores de autenticação;
- renovação e encerramento da sessão;
- listagem e revogação de sessões ativas;
- consulta e atualização dos dados de perfil;
- consulta de disponibilidade e alteração de username;
- upload, atualização e remoção de avatar.

#### Organização financeira

- criação automática de uma conta principal e de categorias iniciais durante o onboarding;
- criação, listagem e atualização de contas financeiras;
- arquivamento, restauração e definição de conta padrão;
- consulta de saldo atual, saldo projetado e resumo agregado das contas;
- criação e gerenciamento de categorias de receitas, despesas e investimentos;
- personalização visual das categorias com cores e ícones;
- arquivamento, restauração e exclusão de categorias;
- transferência das movimentações ao excluir uma categoria em uso;
- registro de receitas, despesas e transferências entre contas;
- lançamentos pendentes ou efetivos;
- confirmação, edição e exclusão de lançamentos;
- listagem paginada com filtros por conta, categoria, tipo, status e período;
- ordenação e resumo financeiro das movimentações.

#### Comunicação

- envio de e-mail de boas-vindas;
- envio e reenvio de e-mail para verificação de endereço.

### Capacidades técnicas do backend

- API REST documentada com Swagger e OpenAPI;
- isolamento dos dados de cada usuário a partir da sessão autenticada;
- autenticação baseada em cookies HTTP-only;
- rotação de refresh tokens e gerenciamento de sessões no Redis;
- armazenamento de valores monetários em centavos;
- tratamento separado de datas civis e instantes com timezone;
- arquitetura modular orientada por Domain-Driven Design e Clean Architecture;
- persistência em PostgreSQL e cache com Redis;
- processamento e normalização de imagens para WebP;
- armazenamento de mídia no Cloudflare R2 por meio de uma interface compatível com S3;
- processos separados para API HTTP e worker assíncrono;
- publicação confiável de eventos com Transactional Outbox;
- processamento de jobs com BullMQ e Redis dedicado;
- retries, backoff, idempotência e reconciliação de mensagens;
- health checks independentes para API e worker;
- testes unitários, E2E, de integração e smoke test do container;
- integração e entrega contínuas com publicação de imagens multi-arquitetura, análise de vulnerabilidades, deploy seguro e rollback.

## Destaques de engenharia

O backend foi estruturado para manter regras financeiras simples de evoluir sem ignorar os problemas operacionais encontrados em produção. A visão completa dos componentes, camadas, dependências e padrões de contribuição está em [Arquitetura e organização do código](./docs/architecture.md).

### API e worker separados

A API HTTP e o worker assíncrono usam o mesmo código, build e imagem Docker, mas são executados como processos independentes.

A API recebe requisições, autentica usuários, executa casos de uso, persiste alterações e registra trabalho assíncrono. O worker processa eventos, executa handlers, consome filas, envia e-mails e realiza tarefas de reconciliação e limpeza.

Essa separação permite escalar os dois processos de forma independente e impede que novas réplicas da API iniciem consumidores de eventos ou processors de filas.

### Transactional Outbox

Eventos importantes são persistidos na mesma transação PostgreSQL que altera os dados de negócio.

```text
Request HTTP
    |
    v
Use case
    |
    v
Transação PostgreSQL
    ├── dados de negócio
    └── mensagem da outbox
              |
              v
            Worker
              |
              v
      handlers idempotentes
```

O worker reivindica mensagens com `FOR UPDATE SKIP LOCKED`, protege o processamento com ownership e renovação de leases e recupera tentativas interrompidas. O fluxo assume entrega at-least-once, portanto seus consumidores são projetados para tolerar repetição.

### Filas e jobs

BullMQ executa trabalhos assíncronos com tentativas configuráveis, backoff, retenção e concurrency controlada. As filas usam uma instância Redis dedicada, com AOF e política `noeviction`, separada do Redis de cache e sessões.

No fluxo de e-mail, a intenção é persistida no PostgreSQL antes do enqueue. Se houver uma falha entre o commit e a criação do job, um reconciliador do worker reenfileira a mesma intenção usando um `jobId` determinístico.

### Assets e Cloudflare R2

Assets representam no PostgreSQL a identidade, o ownership, a finalidade, a storage key, a metadata e o estado de um objeto. Os bytes permanecem no Cloudflare R2 por meio de uma interface compatível com S3.

O módulo consumidor decide o significado do arquivo, Assets controla seu ciclo de vida e o adapter de Object Storage esconde os detalhes do provider. No fluxo de avatar, a imagem é validada pelos bytes, normalizada, convertida para WebP e enviada ao R2; versões substituídas são removidas de forma assíncrona e idempotente.

### Autenticação orientada a sessões

Access e refresh tokens são transportados em cookies HTTP-only. O Redis mantém o estado das sessões, metadata dos dispositivos e a blacklist necessária para revogação antecipada.

Refresh tokens são rotacionados a cada uso. O desenho permite listar sessões, identificar conexões ativas, revogar uma sessão específica e reagir a possíveis tentativas de replay.

### Estratégia de testes

- **Testes unitários:** validam domínio, casos de uso, configuração e adapters isolados com dependências controladas.
- **Testes E2E:** exercitam a aplicação NestJS e verificam contratos HTTP, guards, validação e serialização.
- **Testes de integração:** usam Testcontainers com PostgreSQL, Redis, BullMQ e Toxiproxy para provar concorrência, leases, retries e recuperação após falhas reais.
- **Smoke test da imagem:** constrói o artefato final, aplica migrations, inicia API e worker separados e valida readiness e health nos containers que serão publicados.

## Tecnologias

### Aplicação

- **Node.js 22:** runtime da API, do worker e dos comandos operacionais;
- **TypeScript 5:** linguagem principal com tipagem estática;
- **NestJS 11:** framework da aplicação, injeção de dependências e composição dos processos;
- **TypeORM 0.3:** persistência relacional, repositories e migrations;
- **PostgreSQL 16:** fonte da verdade para dados de negócio, outbox, assets e intenções de e-mail;
- **Redis 7:** cache, rate limiting, sessões stateful e blacklist de tokens;
- **BullMQ 5:** filas, jobs, retries, backoff e processamento concorrente;
- **EventEmitter2:** distribuição local dos eventos reidratados dentro do worker;
- **Passport, JWT e bcrypt:** autenticação local, OAuth, emissão de tokens e proteção de senhas;
- **Joi e Zod:** validação de configuração e de payloads persistidos;
- **class-validator e class-transformer:** validação e transformação dos contratos HTTP;
- **Sharp e file-type:** detecção, normalização e conversão de imagens;
- **NestJS Terminus:** liveness e readiness da API.

### Integrações

- **Google OAuth 2.0:** login social e vinculação de provedores;
- **Cloudflare R2:** armazenamento de objetos e mídia;
- **AWS SDK for S3:** comunicação com a API compatível com S3 do R2;
- **Brevo Transactional Email:** envio de e-mails e templates;
- **GeoIP Lite:** geolocalização aproximada das sessões a partir do endereço IP;
- **UAParser:** identificação de navegador, sistema operacional e dispositivo;
- **Swagger e OpenAPI:** documentação interativa e descrição dos contratos da API.

### Qualidade e testes

- **Jest:** testes unitários, de composição e cobertura;
- **Supertest:** testes E2E dos contratos HTTP;
- **Testcontainers:** PostgreSQL e Redis reais e descartáveis nos testes de integração;
- **Toxiproxy:** simulação controlada de indisponibilidade e recuperação de rede;
- **ESLint:** análise estática e padronização do TypeScript;
- **Prettier:** formatação automatizada do código e da documentação.

### Infraestrutura e entrega

- **Oracle Cloud Infrastructure:** hospedagem da VPS de produção;
- **Ubuntu Server 22.04 LTS:** sistema operacional do host;
- **Amazon RDS:** PostgreSQL gerenciado e externo ao Docker Compose;
- **Docker e Docker Compose:** empacotamento e execução da API, worker e serviços Redis;
- **NGINX:** proxy reverso, terminação TLS e encaminhamento do IP real do cliente;
- **Cloudflare:** DNS, proxy da aplicação, certificado de origem e entrega pública dos assets;
- **GitHub Actions:** integração contínua, testes, publicação e deploy;
- **GitHub Container Registry:** armazenamento das imagens OCI versionadas;
- **Release Please:** automação de versões, changelog, tags e GitHub Releases;
- **Trivy:** análise de vulnerabilidades das imagens AMD64 e ARM64;
- **Tailscale:** acesso privado ao host e deploy remoto com identidade efêmera;
- **Docker Buildx:** publicação do manifest multi-arquitetura;
- **GitHub Environments:** aprovação e isolamento dos secrets de produção.

## Executando localmente

O fluxo recomendado executa PostgreSQL, Redis e o Redis dedicado do BullMQ com Docker Compose, enquanto API e worker rodam localmente em modo watch.

O passo a passo completo — requisitos de software, variáveis de ambiente, Google OAuth, Cloudflare R2, migrations, inicialização e diagnóstico — está no [Guia de desenvolvimento local](./docs/getting-started.md).

As variáveis obrigatórias, condicionais e com default estão catalogadas por processo na [Referência de configuração](./docs/configuration.md).

Para consultar build, qualidade, testes, migrations, Docker e health checks individualmente, veja [Comandos principais](./docs/commands.md).

## Documentação

A documentação técnica está organizada em [`docs/`](./docs/README.md). Os principais pontos de entrada são:

- [Arquitetura e organização do código](./docs/architecture.md);
- [Desenvolvimento local](./docs/getting-started.md);
- [Configuração por variáveis de ambiente](./docs/configuration.md);
- [Comandos principais](./docs/commands.md);
- [Documentação pública da API](https://api.danfy.app/docs);
- [Integração contínua](./docs/platform/continuous-integration.md);
- [Atualizações de dependências](./docs/platform/dependency-updates.md);
- [Releases e entrega contínua](./docs/platform/continuous-delivery.md);
- [Guia de deploy](./docs/deploy.md);
- [Operação do worker](./docs/platform/worker-operations.md);
- [Infraestrutura de filas](./docs/platform/queue-infrastructure.md);
- [Mapa de eventos](./docs/events/README.md);
- [Schema do banco de dados](./docs/database/schema.md);
- [Especificações técnicas](./docs/specs/).

## Limitações atuais

O Danfy v0 representa a fundação inicial do produto e ainda possui limitações conhecidas:

- o planejamento financeiro assistido por inteligência artificial ainda não está disponível;
- a alteração de senha para usuários autenticados ainda não foi implementada;
- a política de saldo negativo continua como uma decisão aberta de produto;
- contas de cartão de crédito e investimento existem no modelo, mas ainda não possuem regras financeiras profundas;
- recorrência, parcelamento, faturas, reembolsos e investimentos não fazem parte do núcleo atual de transações;
- observabilidade e alertas para indisponibilidade de PostgreSQL, Redis, API e worker ainda serão ampliados.

Essas limitações descrevem o estado atual do produto e não representam falhas ocultas ou promessas de prazo.

## Roadmap

As próximas direções planejadas incluem:

- consolidar a política de saldo negativo;
- implementar alteração segura de senha e ampliar alertas de segurança;
- evoluir observabilidade, métricas e alertas operacionais;
- introduzir planejamento mensal e análises assistidas por inteligência artificial;
- definir regras específicas para cartão de crédito e investimentos;
- evoluir recorrência, parcelamento, orçamentos e metas;
- estudar importação de dados e integração com instituições financeiras.

O roadmap apresenta intenções de evolução e pode mudar conforme validação do produto, prioridades técnicas e aprendizados da v0.

## Participação e contribuições

Issues, sugestões e relatos de bugs são bem-vindos pelos [templates públicos do projeto](https://github.com/danzSTK/personal-finance-backend/issues/new/choose). Vulnerabilidades também são bem-vindas, mas devem ser enviadas exclusivamente pelo canal privado descrito em [SECURITY.md](./SECURITY.md).

Contribuições externas de código ainda não estão abertas. Caso deseje ajudar no desenvolvimento, consulte [CONTRIBUTING.md](./CONTRIBUTING.md) e entre em contato com o autor antes de criar qualquer modificação ou pull request.

Para dúvidas, incidentes operacionais, parcerias ou licenciamento, consulte [SUPPORT.md](./SUPPORT.md). Toda interação nos espaços do projeto está sujeita ao [Código de Conduta](./CODE_OF_CONDUCT.md).

## Segurança

Problemas de segurança não devem ser publicados diretamente em uma issue pública. Consulte a [Política de Segurança](./SECURITY.md) e use exclusivamente o [GitHub Private Vulnerability Reporting](https://github.com/danzSTK/personal-finance-backend/security/advisories/new).

## Autor

Desenvolvido por **Daniel Félix**.

- [LinkedIn](https://www.linkedin.com/in/danielfelixdev/)
- [GitHub](https://github.com/danzSTK)
- Portfólio — em breve

Todo e qualquer colaborador do projeto será explicitamente citado e agradecido por sua contribuição.

## License

Danfy is source-available software licensed under the [PolyForm Strict License 1.0.0](./LICENSE).

Noncommercial use is permitted. Modification, redistribution, derivative works, and commercial use are not permitted.

No trademark rights are granted under the software license. See [TRADEMARKS.md](./TRADEMARKS.md).

For commercial licensing or other permissions, contact [danielfelix.dev@gmail.com](mailto:danielfelix.dev@gmail.com).
