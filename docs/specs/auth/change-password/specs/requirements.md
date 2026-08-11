# Requisitos — alteração de senha autenticada

## Objetivo

Permitir que um usuário autenticado altere a senha do provider local `EMAIL`
com confirmação da senha atual, proteção contra abuso, controle de concorrência,
revogação de todas as sessões e publicação resiliente dos fatos de segurança.
Os fatos de senha alterada e bloqueio iniciado também devem produzir intenções
idempotentes de e-mail transacional, processadas de forma assíncrona pelo worker.

## Escopo funcional

### R1 — acesso ao recurso

- A rota deve exigir uma sessão autenticada.
- O `userId` deve vir exclusivamente do JWT validado.
- O usuário deve possuir um provider `EMAIL` com hash de senha.
- Uma conta exclusivamente OAuth deve receber o erro
  `PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED`.
- A presença simultânea dos providers `EMAIL` e `GOOGLE` não impede a operação.

### R2 — validação das senhas

- `currentPassword` e `newPassword` devem ser strings entre os limites vigentes
  de senha do módulo de usuários.
- A senha atual deve ser comparada com o hash persistido.
- Uma senha atual incorreta deve retornar `403` com
  `CURRENT_PASSWORD_INVALID`; a sessão continua autenticada.
- A nova senha deve ser diferente da senha atual confirmada.
- Igualdade entre as senhas deve retornar `400` com
  `NEW_PASSWORD_MUST_DIFFER`.
- Somente uma comparação malsucedida da senha atual conta como falha.
- Erros de DTO, ausência de provider, igualdade das senhas, cooldown, limite
  diário, concorrência ou indisponibilidade não aumentam o contador.

### R3 — falhas e bloqueio por usuário

- Falhas são contadas em uma janela móvel de 15 minutos.
- A quinta falha dentro da janela deve persistir:
  - `CURRENT_PASSWORD_FAILED`;
  - `FAILED_ATTEMPTS_BLOCK_STARTED`.
- O primeiro bloqueio deve durar 1 hora.
- Se um novo bloqueio começar até 24 horas após o início do anterior, deve durar
  24 horas.
- A quinta falha deve retornar `429` com `PASSWORD_CHANGE_BLOCKED` e
  `retryAfterSeconds`.
- Enquanto o bloqueio estiver ativo, a rota deve retornar o mesmo erro antes de
  executar bcrypt.
- O bloqueio vale somente para alteração de senha.

### R4 — alterações concluídas

- Deve existir cooldown de 10 minutos após uma alteração concluída.
- Cada usuário pode concluir no máximo 3 alterações em uma janela móvel de
  24 horas.
- Cooldown ativo deve retornar `429` com
  `PASSWORD_CHANGE_COOLDOWN_ACTIVE`.
- Limite diário ativo deve retornar `429` com
  `PASSWORD_CHANGE_DAILY_LIMIT_EXCEEDED`.
- Toda resposta `429` da feature deve conter:
  - header `Retry-After`, em segundos inteiros;
  - `details.retryAfterSeconds` no contrato de erro da plataforma.

### R5 — concorrência

- No máximo uma mutação de senha pode ficar em andamento por usuário.
- Requisições concorrentes não podem executar duas alterações válidas usando a
  mesma senha atual.
- A barreira deve ser adquirida atomicamente no Redis antes da comparação de
  hash e deve ter TTL para recuperação de processo interrompido.
- Uma requisição que não adquirir a barreira deve retornar `429` com
  `PASSWORD_CHANGE_OPERATION_PENDING` e tempo previsível.
- A linha de `users` deve ser bloqueada com `pessimistic_write` durante a
  transação de alteração.

### R6 — persistência e estado operacional

- PostgreSQL deve manter os fatos append-only em `password_change_events`.
- Redis deve manter uma projeção operacional por usuário:
  - falhas recentes;
  - bloqueio ativo;
  - início do bloqueio anterior;
  - alterações concluídas recentes;
  - marcador de projeção inicializada;
  - barreira de mutação em andamento.
- Estado Redis ausente não significa operação permitida: a projeção deve ser
  reconstruída do PostgreSQL.
- Redis indisponível deve falhar de forma fechada com `503` e
  `PASSWORD_CHANGE_STATE_UNAVAILABLE`.
- Após cada commit que registre eventos, a projeção deve ser sincronizada
  imediatamente e também deve existir um evento de outbox para reconciliação.
- O Redis operacional deve usar `maxmemory-policy noeviction`.

### R7 — conclusão atômica

Uma alteração concluída deve gravar na mesma transação:

- novo hash no provider `EMAIL`;
- incremento de `users.credential_version`;
- evento `PASSWORD_CHANGED`;
- eventos correspondentes na outbox.

Falhas anteriores ao commit não podem modificar senha, versão da credencial ou
sessões.

### R8 — revogação de sessões

- Access e refresh tokens devem carregar `credentialVersion`.
- As estratégias JWT devem comparar a versão do token com a versão atual
  consultada sem cache no PostgreSQL.
- Tokens antigos sem a claim são tratados como versão `1` para compatibilidade
  de implantação.
- Depois do incremento, todos os tokens anteriores devem falhar na próxima
  requisição, inclusive o token que realizou a alteração.
- A API deve limpar os cookies de access e refresh token na resposta de sucesso.
- A limpeza física das sessões Redis deve ser tentada após o commit.
- Uma falha nessa limpeza não desfaz a senha: o evento
  `auth.sessions.revoke-all-requested` deve permitir retry no worker.

### R9 — eventos para observabilidade e notificações

Devem atravessar a transactional outbox:

- `auth.password-change.state-refresh-requested`, após qualquer fato persistido;
- `auth.password-change.changed`, após alteração concluída;
- `auth.password-change.block-started`, quando um bloqueio começar;
- `auth.sessions.revoke-all-requested`, após alteração concluída.

Os payloads podem conter identificadores, instante, fim do bloqueio e contexto
sanitizado de IP, localização, navegador, sistema e dispositivo. Não podem
conter senhas, hashes, JWTs, JTIs, cookies ou headers completos.

### R10 — proteção técnica de custo

- A rota deve ter limites adicionais antes do use case:
  - 6 solicitações por sessão em 1 minuto;
  - 30 solicitações por IP em 1 minuto.
- Os incrementos e TTLs devem ser atômicos no Redis.
- IP e identificador de sessão devem ser convertidos em fingerprints HMAC antes
  de compor chaves Redis.
- O segredo HMAC deve vir da configuração, possuir no mínimo 32 caracteres e
  nunca ser registrado.
- O IP deve vir de `request.ip`, respeitando a configuração explícita de
  `trust proxy`; headers encaminhados não devem ser lidos diretamente.
- Indisponibilidade apenas do limitador técnico não substitui nem desativa a
  policy por usuário.

### R11 — API

- Endpoint: `POST /auth/password/change`.
- Body: `currentPassword` e `newPassword`.
- Sucesso: `200` com response DTO identificado por
  `object: "auth.password_change"`.
- A rota deve permanecer protegida pelos guards globais de origem, JWT, status
  de verificação de e-mail e throttling.

### R12 — notificações transacionais de segurança

- `auth.password-change.changed` deve criar uma intenção de e-mail do tipo
  `PASSWORD_CHANGED`, usando `password-changed:v1`.
- `auth.password-change.block-started` deve criar uma intenção de e-mail do tipo
  `PASSWORD_CHANGE_BLOCKED`, usando `password-change-blocked:v1`.
- Cada intenção deve ser idempotente pelo `sourceEventId`; o reprocessamento da
  outbox não pode criar mensagens duplicadas.
- O handler deve enfileirar mensagens novas ou reenfileiráveis e ignorar
  mensagens em estado terminal.
- A intenção deve usar o e-mail atual do usuário persistido, sem confiar em um
  destinatário vindo do payload da outbox.
- Nome ausente deve usar a parte local do e-mail e, se ela também estiver
  indisponível, `cliente`.
- Contexto ausente deve ser exibido como `Não identificado`.
- Datas exibidas nos e-mails devem ser persistidas nos parâmetros no formato
  `DD/MM/AAAA às HH:mm`, convertidas para `America/Sao_Paulo` e identificadas no
  template como horário de Brasília.
- Os templates devem usar `security@danfy.app` como remetente configurado na
  Brevo; o worker não deve sobrescrever o remetente de e-mails que usam
  `templateId`.
- Cada template deve possuir preheader oculto, útil e com no máximo 35
  caracteres.
- Os parâmetros devem ser validados em runtime pelo contrato Zod antes da
  persistência e novamente pelo worker antes do provider.
- Os IDs da Brevo devem existir somente na configuração da infraestrutura e ser
  resolvidos a partir de `template_key + template_version`.
- Falhas no fluxo de notificação não podem desfazer a alteração de senha ou o
  bloqueio já confirmados no PostgreSQL; devem seguir as tentativas da outbox e
  da fila.
- Nenhum template ou parâmetro pode conter senha, hash, JWT, JTI, cookie ou
  segredo.

## Contrato de erros

| Código                                    | HTTP | Situação                                  |
| ----------------------------------------- | ---: | ----------------------------------------- |
| `CURRENT_PASSWORD_INVALID`                |  403 | senha atual não confere                   |
| `PASSWORD_CHANGE_EMAIL_PROVIDER_REQUIRED` |  409 | conta não possui senha local              |
| `NEW_PASSWORD_MUST_DIFFER`                |  400 | nova senha igual à atual confirmada       |
| `PASSWORD_CHANGE_BLOCKED`                 |  429 | bloqueio por falhas ativo ou iniciado     |
| `PASSWORD_CHANGE_COOLDOWN_ACTIVE`         |  429 | cooldown de 10 minutos                    |
| `PASSWORD_CHANGE_DAILY_LIMIT_EXCEEDED`    |  429 | três alterações em 24 horas               |
| `PASSWORD_CHANGE_OPERATION_PENDING`       |  429 | mutação concorrente em andamento          |
| `PASSWORD_CHANGE_COST_LIMITED`            |  429 | limite técnico por IP ou sessão           |
| `PASSWORD_CHANGE_STATE_UNAVAILABLE`       |  503 | estado operacional não pode ser garantido |

## Requisitos de segurança

- Senhas e hashes nunca aparecem em logs, eventos, metadata ou respostas.
- `User-Agent` deve ser truncado ao limite de 512 caracteres.
- Metadata aceita apenas chaves conhecidas e strings limitadas.
- Os eventos de banco devem manter integridade temporal por constraints.
- A consulta de histórico deve filtrar obrigatoriamente por `userId`.
- A rota não deve informar hash, provider interno ou motivo técnico sensível.

## Critérios de aceite

- O fluxo de sucesso altera a senha, incrementa a versão, grava auditoria e
  outbox, revoga tokens logicamente, limpa cookies e agenda limpeza física.
- A senha anterior deixa de autenticar e a nova passa a autenticar.
- Cinco falhas em 15 minutos criam bloqueio; reincidência em 24 horas cria
  bloqueio de 24 horas.
- Bloqueio, cooldown e limite diário rejeitam antes de bcrypt.
- No máximo uma requisição concorrente conclui.
- Perda das chaves operacionais permite reconstrução pelo PostgreSQL.
- Cada evento de senha alterada ou bloqueio iniciado cria no máximo uma intenção
  de e-mail e pode ser reprocessado com segurança.
- Os dois templates possuem contrato TypeScript, schema Zod, HTML versionado,
  mapping de provider e documentação sincronizados.
- Todos os códigos, headers e payloads seguem o contrato central da plataforma.
- Testes de domínio, aplicação, infraestrutura, integração e E2E cobrem os
  cenários e invariantes definidos nesta spec.

## Fora de escopo

- Recuperação de senha sem sessão.
- Criação do primeiro provider local para conta OAuth.
- MFA, histórico de senhas e dispositivos confiáveis.
- Preferências para desativar e-mails de segurança obrigatórios.
- Backfill ou replay de eventos locais anteriores à existência dos handlers de
  notificação.
