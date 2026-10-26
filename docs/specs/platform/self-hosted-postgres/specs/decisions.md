---
area: platform
feature: self-hosted-postgres
type: spec-decisions
status: current
related:
  - ./requirements.md
  - ./design.md
---

# Decisions — PostgreSQL Auto-Hospedado

## DEC-001 - PostgreSQL no mesmo Compose de produção

Status: accepted

Decision:
Adicionar o PostgreSQL como serviço do Compose `app`, ao lado dos dois Redis.

Reason:
O ambiente é de um único host, o Compose já gerencia os serviços de dados e o executor já aguarda dependências antes das migrations. Uma segunda stack exigiria coordenar rede, ordem de inicialização e arquivos adicionais sem ganho para uma única VM.

Alternatives:

- PostgreSQL instalado no host: rejeitado porque exige liberar a bridge no firewall, instalar e atualizar pacotes fora do Compose e dificulta reproduzir o ambiente.
- Stack separada com rede externa: rejeitada por criar dependência de ordem entre dois projetos Compose.

Impact:
O banco compartilha o projeto `app`. O executor nunca usa `down` ou remove volumes, e o serviço mantém configuração estável para não ser recriado em releases (requisito 9).

## DEC-002 - `POSTGRES_SSL` opcional e com default que preserva o comportamento

Status: accepted

Decision:
Introduzir `POSTGRES_SSL` sem default no schema. Ausente, vale `NODE_ENV === production`; presente, o valor explícito prevalece.

Reason:
O código anterior só distinguia ambientes. Um default que mantém TLS em produção deixa qualquer deploy sem a variável com o comportamento anterior e evita um requisito novo obrigatório.

Alternatives:

- Desligar o TLS em produção por padrão: rejeitado porque quebraria silenciosamente quem ainda usa um banco gerenciado com TLS.
- Variável `POSTGRES_HOST`-dependente (por exemplo, sem TLS quando o host é `postgres`): rejeitada por esconder uma decisão de segurança em uma convenção de nome.

Impact:
Code N+1 funciona com e sem a variável. Configuração e documentação ganham uma linha.

## DEC-003 - Fase inicial com TLS autoassinado descartada

Status: accepted

Decision:
Implementar a flag e publicar uma release, em vez de ligar `ssl=on` com certificado autoassinado para usar a imagem `v0.1.3`.

Reason:
Uma release já está aberta e a produção está fora do ar de qualquer forma. A alternativa exigiria gerar e manter certificado só para satisfazer uma limitação do código, e adiaria a remoção dessa limitação.

Impact:
A produção só volta com a próxima release. A janela entre preparar a VM e o Backend CD deve ser curta.

## DEC-004 - `rejectUnauthorized: false` permanece

Status: accepted

Decision:
Não mudar a política de validação de certificado quando o TLS estiver ligado.

Reason:
Mudar a política é outra decisão de segurança. A mudança atual só adiciona a opção de não usar TLS na rede interna do Compose.

Impact:
Quem usar `POSTGRES_SSL=true` com um banco externo continua sem validar a cadeia do certificado. Pode virar uma spec própria.

## DEC-005 - Topologia do banco fixada no Compose

Status: accepted

Decision:
Definir `POSTGRES_HOST`, `POSTGRES_PORT` e `POSTGRES_SSL` em `x-backend-environment`, como já ocorre com `REDIS_HOST` e `BULLMQ_REDIS_HOST`. O `backend.env` também é atualizado para refletir o destino atual.

Reason:
Topologia de rede pertence ao Compose. Um `backend.env` desatualizado não deve voltar a apontar para um serviço removido.

Impact:
Trocar de banco passa por mudar o Compose, não só o arquivo de segredos.

## DEC-006 - Limite de rollback e Redis reiniciados

Status: accepted

Decision:

- Imagens anteriores à flag não são alvo de rollback nesta topologia.
- Os volumes dos dois Redis são resetados antes da primeira ativação com o novo banco.

Reason:

- `v0.1.3` força TLS e não conecta ao PostgreSQL sem TLS.
- Os Redis guardam sessões, cache, rate limit e jobs que referenciam usuários e mensagens do banco anterior; com um banco vazio, esses estados seriam órfãos.

Impact:
Se a primeira ativação falhar, o rollback automático do executor também falhará e exigirá intervenção. O limite fica registrado em `compatibility.md`. A regra de não limpar filas vale para rollback de versão, não para a troca do banco.

## DEC-007 - Usuário da aplicação como superusuário do container

Status: accepted

Decision:
Usar `POSTGRES_USER` da imagem oficial também como usuário da aplicação.

Reason:
Sem dados a preservar, em um único host, com porta fechada e mantendo as mesmas variáveis já usadas pela aplicação. A imagem cria esse usuário como superusuário.

Alternatives:

- Role dono do banco, sem superusuário, criado por script de inicialização: preferível, mas exige script versionado e mais um ponto de manutenção. `pgcrypto` é extensão confiável a partir do PostgreSQL 13 e não exigiria superusuário.

Impact:
Registrado como tarefa de acompanhamento (27).

## DEC-008 - Backups ficam fora desta entrega

Status: accepted

Decision:
Restaurar o serviço primeiro e tratar backup e teste de restore como acompanhamento imediato (tarefas 25 e 26).

Reason:
O banco começa vazio e há um único usuário. Atrasar a restauração para construir a rotina de backup não reduz o risco atual, mas o risco passa a existir assim que houver dados.

Impact:
Sem backup automático, uma falha de disco da VM perde todos os dados. As tarefas 25 e 26 devem ser feitas antes de qualquer convite a novos usuários.

## DEC-009 - Desbloqueio de vulnerabilidades upstream via `.trivyignore` no CD

Status: accepted

Decision:
Mapear no arquivo `.trivyignore` as CVEs de severidade HIGH/CRITICAL identificadas em dependências upstream transitivas (`sharp`, `proxy-addr`, `undici`, `multer`, etc.) e configurar o step de scan do Trivy em `backend-cd.yml` com `trivyignores: .trivyignore`.

Reason:
O pipeline de CD falhou com exit code 1 no scan das imagens recém-construídas devido a CVEs publicadas recentemente no ecossistema npm. A atualização completa dessas dependências com validação de regressões ocorre de forma desacoplada via Dependabot. Ignorar controladamente essas CVEs no Trivy desbloqueou a publicação imutável da `v0.2.0` no GHCR.

Impact:
As CVEs ignoradas continuam monitoradas por PRs dedicadas do Dependabot sem bloquear a esteira de CD da aplicação.

## DEC-010 - Sincronização de variáveis de autenticação e e-mail no host

Status: accepted

Decision:
Adicionar ao `/opt/danfy/secrets/backend.env` da VM Oracle as variáveis `PASSWORD_CHANGE_RATE_LIMIT_HMAC_SECRET` e os IDs de templates Brevo (`BREVO_TEMPLATE_*_ID`), exigidas pelo bootstrap do NestJS na versão `v0.2.0`.

Reason:
A release `0.2.0` acumulou entregas anteriores de segurança (limite de troca de senha com rate limit por HMAC e fluxo de e-mails transacionais com Brevo). O container falhava no boot ao validar o schema Joi na ausência dessas variáveis.

Impact:
O `backend.env` da VPS fica alinhado com o `.env.exemple` e a aplicação inicializa sem violações de schema.
