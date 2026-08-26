---
area: auth
feature: email-verification
type: spec-requirements
status: current
related:
  - ../../../../auth/flows/sign-up.md
  - ../../../../auth/flows/sign-in.md
  - ../../../../auth/flows/google-login.md
  - ../../../../auth/reference/endpoints.md
  - ../../../../events/user-created.md
  - ../../../../notifications/README.md
  - ../../../../auth/email-verification/redis-keys.md
  - ../../../../auth/email-verification/lua-scripts.md
  - ../../../../database/schema.md
---

# Requirements - Email Verification

## Objetivo

Introduzir confirmação de e-mail para contas criadas por credenciais sem impedir login inicial, mas bloqueando por padrão o acesso aos recursos do produto enquanto o usuário estiver com e-mail pendente.

O fluxo deve criar desafios de verificação por token, enviar e-mails transacionais, permitir confirmação via `POST`, permitir reenvio autenticado com cooldown exponencial limitado e limite diário manual, expor o estado operacional do reenvio para o frontend e disparar o e-mail de boas-vindas somente depois que contas credentials forem verificadas.

## Contexto

Hoje o cadastro por credenciais cria usuário `ACTIVE`, gera tokens e inicia sessão. O evento `user.created` dispara onboarding técnico e já possui consumidor de welcome email em notifications.

O novo comportamento diferencia origens:

- usuários criados por credenciais nascem com `PENDING_EMAIL_VERIFICATION`;
- usuários criados por Google OAuth ficam fora do escopo desta mudança e não devem ser alterados agora;
- usuários pendentes conseguem autenticar, ver o próprio perfil e executar rotas essenciais explicitamente liberadas;
- demais recursos protegidos ficam bloqueados até a confirmação do e-mail.

## Escopo

Esta spec cobre:

- novo status de usuário `PENDING_EMAIL_VERIFICATION`;
- alteração do cadastro por credenciais para criar usuários pendentes;
- guard global de acesso para bloquear usuários pendentes por padrão;
- decorator para liberar rotas autenticadas para usuários pendentes;
- tabela `email_verification_challenges`;
- geração, hash, expiração, consumo e reenvio de tokens de verificação;
- envio automático inicial de e-mail de verificação via `user.created`;
- endpoint público de confirmação por `POST`;
- endpoint autenticado de reenvio;
- origem persistida de cada challenge como envio automático ou reenvio manual;
- estado operacional de cooldown, janela móvel e mutação concorrente no Redis;
- cooldown inicial de 60 segundos com progressão exponencial limitada a 600 segundos;
- limite de 5 reenvios manuais por usuário em janela móvel de 24 horas;
- envio automático fora do limite diário manual, mas incluído no cooldown;
- endpoint autenticado de consulta do estado do reenvio;
- `Retry-After` no header e no contrato quando cooldown, limite diário ou mutação concorrente impedirem nova tentativa;
- prazo genérico `deliver_before` nas intenções de e-mail e cancelamento de mensagens que não preservem a janela mínima de uso do token;
- novo evento `user.email.verified`;
- bloqueio do welcome email no `user.created` quando o usuário estiver pendente;
- envio do welcome email depois de `user.email.verified`;
- erros frontend-facing necessários;
- migration e atualização de `docs/database/schema.md`;
- documentação de integração e template de e-mail.

## Fora De Escopo

Esta spec não cobre:

- troca de e-mail principal depois do cadastro;
- qualquer alteração no fluxo Google OAuth;
- verificação de e-mail ao vincular provider EMAIL em conta OAuth existente;
- recuperação de senha;
- MFA;
- expiração ou revogação automática de sessões já existentes após confirmar e-mail;
- tela/frontend de verificação;
- webhooks de delivery/open/click/bounce;
- limpeza agendada de challenges antigos;
- painel administrativo para challenges/e-mails.
- prioridade de jobs ou diferenciação de prioridade entre tipos de e-mail;
- alteração da quantidade padrão de tentativas ou do backoff do BullMQ;

## Regras De Negócio

### Status de usuário

- `PENDING_EMAIL_VERIFICATION` representa usuário autenticável cujo e-mail principal ainda não foi confirmado.
- `ACTIVE` representa usuário liberado para usar recursos do produto.
- `BLOCKED` continua bloqueando autenticação e acesso.
- `PENDING_PROFILE` permanece no enum por compatibilidade, mas não deve ser usado para verificação de e-mail.
- Usuário criado por credenciais deve nascer `PENDING_EMAIL_VERIFICATION`.
- Usuário criado por Google OAuth não deve ser alterado por esta feature.

### Acesso com e-mail pendente

- Usuário pendente pode logar e receber cookies HttpOnly.
- Usuário pendente não pode usar recursos protegidos por padrão.
- Rotas autenticadas liberadas para pendente devem ser marcadas com decorator explícito.
- O frontend deve conseguir chamar `GET /users/me` para ler `status` e montar a UX.
- Rotas de alteração de perfil, username, avatar, contas, categorias e transações devem permanecer bloqueadas para usuário pendente.
- A falha de autorização por e-mail pendente deve retornar `403 Forbidden` com código `EMAIL_VERIFICATION_REQUIRED`.

### Rotas essenciais

Rotas liberadas para usuário pendente:

- `POST /auth/sign-in`;
- `POST /auth/logout`;
- `POST /auth/refresh`;
- `GET /users/me`;
- `POST /auth/email-verification/confirm`;
- `POST /auth/email-verification/resend`.
- `GET /auth/email-verification/resend/status`.

Rotas públicas continuam públicas. A confirmação é pública porque o token completo chega pela URL do frontend e o frontend envia o token por `POST` ao backend.

### Challenge e token

- Cada challenge deve ter purpose `EMAIL_VERIFICATION`.
- Cada challenge deve persistir `origin` como `AUTOMATIC`, `MANUAL_RESEND` ou `LEGACY_UNKNOWN`; este último cobre o backfill e writes da imagem anterior durante a janela de rollback.
- O token completo deve ser enviado somente no link do e-mail.
- O banco deve armazenar apenas `token_hash`, nunca o token em claro.
- O token deve expirar 15 minutos após criação.
- Challenge consumido deve preencher `consumed_at`.
- Um challenge expirado ou consumido não deve confirmar usuário pendente.
- Confirmação deve ser feita por `POST`, não por `GET`, para evitar confirmação por prefetch, crawler ou fake view.

### Envio automático

- Quando `user.created` for processado para usuário `PENDING_EMAIL_VERIFICATION`, o sistema deve criar challenge e enviar e-mail de verificação.
- O envio automático inicial não conta no limite de 5 reenvios manuais por 24 horas.
- O envio automático inicia cooldown de 60 segundos.
- O processamento repetido do mesmo envio automático deve ser idempotente e não pode criar challenges automáticos duplicados.
- Quando `user.created` for processado para usuário que não está pendente, o sistema não deve enviar e-mail de verificação.
- Quando `user.created` for processado para usuário `PENDING_EMAIL_VERIFICATION`, o sistema não deve enviar welcome email.
- Quando `user.created` for processado para usuário que não está pendente, o sistema pode enviar welcome email pelo fluxo atual.

### Reenvio

- Reenvio exige usuário autenticado.
- Reenvio deve usar o usuário autenticado, nunca `userId` ou `email` do body.
- Reenvio só é permitido se o usuário autenticado estiver `PENDING_EMAIL_VERIFICATION`.
- Reenvio deve consultar o estado operacional no Redis pelo usuário autenticado.
- Reenvio deve respeitar cooldown calculado por `min(60 * 2 ^ manualResendsUsed, 600)` segundos.
- `manualResendsUsed` representa a quantidade de reenvios manuais confirmados na janela após o envio atual; portanto, o envio automático gera 60 segundos e os reenvios manuais geram, respectivamente, 120, 240, 480, 600 e 600 segundos.
- Reenvio deve respeitar limite máximo de 5 reenvios manuais confirmados por usuário em janela móvel de 24 horas.
- A criação do challenge e da intenção de e-mail deve ser protegida por uma barreira curta de mutação no Redis.
- Cooldown e limite diário devem contar envios lógicos confirmados, isto é, transações que persistiram challenge e intenção de e-mail; aceite ou entrega pelo provider não altera os contadores.
- Ausência das chaves Redis deve ser tratada como estado vazio: a operação pode prosseguir e inicializar os contadores.
- Indisponibilidade técnica do Redis deve falhar de forma fechada com `503 EMAIL_VERIFICATION_STATE_UNAVAILABLE`.
- Quando o usuário já estiver `ACTIVE`, reenvio deve retornar sucesso idempotente sem criar novo challenge nem enviar e-mail.

### Estado do reenvio

- `GET /auth/email-verification/resend/status` exige usuário autenticado e usa somente sua identidade do JWT.
- Usuário `PENDING_EMAIL_VERIFICATION` deve receber estado de disponibilidade, quantidade manual usada e restante, último envio lógico e tempo restante efetivo.
- Usuário `ACTIVE` deve receber estado terminal `ALREADY_VERIFIED` sem consultar ou alterar contadores.
- Quando o recurso estiver bloqueado, a resposta continua `200`, retorna `available = false`, informa a restrição efetiva e repete o mesmo inteiro positivo em `retryAfterSeconds` e no header `Retry-After`.
- O tempo efetivo deve representar a maior espera entre cooldown, limite diário e mutação concorrente.
- Quando o recurso estiver disponível ou já verificado, `retryAfterSeconds` deve ser `null` e o header `Retry-After` não deve existir.
- A resposta deve usar `Cache-Control: no-store` e ser apropriada para consultas no carregamento da tela, retorno ao foco, após resend e quando o contador local terminar; o frontend não deve depender de polling por segundo.

### Prazo de entrega

- `email_messages.deliver_before` representa o último instante em que o worker pode iniciar uma tentativa útil de entrega.
- Intenções de verificação devem definir `deliver_before = challenge.expires_at - 5 minutos`.
- Intenções que não possuem prazo de entrega devem manter `deliver_before = null`.
- Quando `deliver_before <= agora`, o worker não deve chamar o provider, deve tornar a intenção terminal e deve impedir que o BullMQ consuma as tentativas restantes.
- O token completo, a URL de verificação e os parâmetros do template não podem aparecer no erro terminal nem em logs.

### Constantes da política

- O limite manual `5`, a janela móvel `24 horas`, o cooldown inicial `60 segundos`, o cooldown máximo `600 segundos` e a janela útil mínima `300 segundos` são regras de produto e consumo de recurso mantidas em constantes centrais versionadas, não em variáveis de ambiente.
- O TTL configurado do token deve respeitar a invariante `tokenTtlSeconds >= maxCooldownSeconds + minimumUsableTokenSeconds`; com os valores aprovados, o token permanece válido por 900 segundos.
- `EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES` e `EMAIL_VERIFICATION_DAILY_LIMIT` devem ser removidas da configuração e dos exemplos de ambiente.

### Confirmação

- Confirmação recebe o token no body.
- Confirmação deve localizar challenge por `purpose + token_hash`.
- Confirmação válida deve:
  - confirmar que o challenge não expirou;
  - confirmar que o challenge não foi consumido;
  - bloquear o usuário relacionado para update transacional;
  - alterar status do usuário para `ACTIVE` se estiver `PENDING_EMAIL_VERIFICATION`;
  - preencher `consumed_at`;
  - gravar `user.email.verified` na outbox na mesma transação.
- Se o usuário já estiver `ACTIVE` e o token estiver consumido por confirmação anterior, a operação pode retornar sucesso idempotente.
- Se o usuário estiver `BLOCKED`, a confirmação deve falhar com conflito e não alterar status.

## Requisitos Funcionais

### REQ-001 - Criar usuário credentials pendente

WHEN `POST /auth/sign-up` criar usuário por e-mail e senha
THE SYSTEM SHALL persistir o usuário com status `PENDING_EMAIL_VERIFICATION`.

### REQ-002 - Manter login inicial

WHEN o sign-up por credenciais concluir com sucesso
THE SYSTEM SHALL gerar access token, refresh token, sessão Redis e cookies HttpOnly como no fluxo atual.

### REQ-003 - Não alterar OAuth nesta feature

WHEN o fluxo Google OAuth criar ou autenticar usuário
THE SYSTEM SHALL manter o comportamento atual.

### REQ-004 - Bloquear recurso protegido por padrão

WHEN usuário autenticado tiver status `PENDING_EMAIL_VERIFICATION`
AND a rota protegida não estiver explicitamente liberada para pendente
THE SYSTEM SHALL rejeitar a requisição com `EMAIL_VERIFICATION_REQUIRED`.

### REQ-005 - Liberar rota marcada para pendente

WHEN usuário autenticado tiver status `PENDING_EMAIL_VERIFICATION`
AND a rota protegida estiver marcada com o decorator de liberação
THE SYSTEM SHALL permitir a requisição.

### REQ-006 - Expor perfil ao pendente

WHEN usuário pendente chamar `GET /users/me`
THE SYSTEM SHALL retornar `UserProfileResponseDto` com `status = PENDING_EMAIL_VERIFICATION`.

### REQ-007 - Criar challenge no user.created

WHEN `user.created` for publicado para usuário `PENDING_EMAIL_VERIFICATION`
THE SYSTEM SHALL criar challenge `EMAIL_VERIFICATION` com token expirando em 15 minutos.

### REQ-008 - Enviar e-mail de verificação

WHEN um challenge `EMAIL_VERIFICATION` for criado
THE SYSTEM SHALL criar intenção em `email_messages` e enfileirar job de envio com link para o frontend contendo o token completo.

### REQ-009 - Ignorar verification para usuário ativo

WHEN `user.created` for publicado para usuário que não está `PENDING_EMAIL_VERIFICATION`
THE SYSTEM SHALL não criar challenge de verificação.

### REQ-010 - Não enviar welcome antes da verificação

WHEN `user.created` for publicado para usuário `PENDING_EMAIL_VERIFICATION`
THE SYSTEM SHALL não criar nem enfileirar welcome email.

### REQ-011 - Confirmar por POST

WHEN `POST /auth/email-verification/confirm` receber token válido, não expirado e não consumido
THE SYSTEM SHALL consumir o challenge, ativar o usuário e gravar `user.email.verified`.

### REQ-012 - Enviar welcome após confirmação

WHEN `user.email.verified` for publicado
THE SYSTEM SHALL criar/enfileirar welcome email idempotente para o usuário.

### REQ-013 - Reenviar autenticado

WHEN usuário pendente autenticado chamar `POST /auth/email-verification/resend`
THE SYSTEM SHALL criar novo challenge e enviar novo e-mail se cooldown e limite diário permitirem.

### REQ-014 - Aplicar cooldown exponencial limitado

IF ainda não tiver passado o cooldown calculado desde o último envio lógico
THEN o resend deve falhar com `EMAIL_VERIFICATION_COOLDOWN_ACTIVE` e informar o tempo restante.

### REQ-015 - Aplicar limite diário somente aos resends manuais

IF já existirem 5 reenvios manuais confirmados para o usuário nos últimos 24 horas
THEN o resend deve falhar com `EMAIL_VERIFICATION_DAILY_LIMIT_EXCEEDED` e informar quando o resend manual mais antigo deixará a janela.

### REQ-016 - Nao enumerar e-mails no resend

WHEN o resend for chamado
THE SYSTEM SHALL derivar o e-mail do usuário autenticado e não aceitar e-mail arbitrário no body.

### REQ-017 - Não persistir token em claro

WHEN um challenge for persistido
THE SYSTEM SHALL armazenar apenas `token_hash`.

### REQ-018 - Documentar contrato

WHEN a feature for implementada
THE SYSTEM SHALL atualizar docs de auth, integrations, events, notifications e database schema.

### REQ-019 - Persistir origem do challenge

WHEN um challenge for criado
THE SYSTEM SHALL persistir se sua origem é `AUTOMATIC` ou `MANUAL_RESEND`.

### REQ-020 - Consultar estado do reenvio

WHEN usuário autenticado consultar `GET /auth/email-verification/resend/status`
THE SYSTEM SHALL retornar um response DTO identificado por `email_verification.resend_status` com disponibilidade, contadores e tempo restante.

### REQ-021 - Serializar resends concorrentes

WHEN duas solicitações de resend disputarem o mesmo usuário
THE SYSTEM SHALL permitir no máximo uma mutação e retornar `EMAIL_VERIFICATION_OPERATION_PENDING` com `Retry-After` para a concorrente.

### REQ-022 - Tratar ausência e indisponibilidade do Redis

WHEN as chaves do usuário não existirem
THE SYSTEM SHALL inicializar estado vazio e permitir a avaliação normal.

WHEN o Redis não puder responder
THE SYSTEM SHALL rejeitar resend e status com `503 EMAIL_VERIFICATION_STATE_UNAVAILABLE`.

### REQ-023 - Preservar janela útil de entrega

WHEN o worker processar uma intenção cuja `deliver_before` tenha sido atingida
THE SYSTEM SHALL não chamar o provider, tornar a intenção terminal e encerrar o job sem novas tentativas.

### REQ-024 - Manter política em constantes centrais

WHEN os controles de consumo do resend forem avaliados
THE SYSTEM SHALL usar constantes centrais versionadas para limite, janela, cooldown inicial, cooldown máximo e janela útil mínima.

## Edge Cases

- IF o handler de `user.created` rodar mais de uma vez
  THEN não deve furar limite/cooldown nem enviar e-mails duplicados indevidamente.

- IF o primeiro envio automático falhar no provider
  THEN o challenge permanece criado e o envio segue o ciclo de retry de `email_messages`.

- IF o usuário clicar no link expirado
  THEN confirmação deve falhar com erro estável e frontend pode orientar resend.

- IF o usuário clicar duas vezes no mesmo link depois de sucesso
  THEN confirmação pode retornar sucesso idempotente se o usuário já estiver `ACTIVE`.

- IF dois resends simultâneos ocorrerem
  THEN apenas um deve adquirir a barreira e criar challenge/intenção.

- IF a transação PostgreSQL falhar depois da aquisição da barreira
  THEN a barreira deve ser removida pelo dono ou expirar sem incrementar contador/cooldown.

- IF o PostgreSQL confirmar e o processo falhar antes de finalizar o Redis
  THEN o TTL da barreira deve permitir recuperação e a ausência posterior de estado segue a regra fail-open aprovada.

- IF o estado Redis estiver ausente depois de expiração, limpeza ou perda de chave
  THEN status e resend tratam o usuário como sem cooldown e sem resends manuais usados.

- IF o Redis estiver indisponível
  THEN nenhuma nova intenção manual deve ser persistida.

- IF o job começar no instante exato de `deliver_before`
  THEN o provider não deve ser chamado.

- IF `deliver_before` for nulo
  THEN o fluxo de envio mantém o comportamento atual.

- IF o usuário pendente tentar criar account, category ou transaction
  THEN deve receber `403 EMAIL_VERIFICATION_REQUIRED`.

- IF usuário Google OAuth for criado ou autenticado
  THEN esta feature não deve alterar status, sessão ou provider desse fluxo.

## Critérios De Aceite

- `UserStatus` contém `PENDING_EMAIL_VERIFICATION`.
- `users.status` aceita `PENDING_EMAIL_VERIFICATION` no banco.
- Sign-up credentials cria usuário pendente e ainda inicia sessão.
- Fluxo Google OAuth permanece sem alteração funcional.
- Existe guard global que bloqueia usuário pendente por padrão.
- Existe decorator para liberar rotas para usuário pendente.
- `GET /users/me` funciona para usuário pendente.
- Endpoints de confirmação e resend existem e têm DTOs validados.
- Confirmação é pública e usa `POST`.
- Resend é autenticado e não aceita e-mail/body para escolher destinatário.
- Tabela `email_verification_challenges` existe com migration.
- Tokens são persistidos somente como hash.
- Token expira em 15 minutos.
- Challenges persistem origem automática, manual ou legado desconhecido.
- Envio automático inicia cooldown de 60 segundos e não consome o limite manual.
- Resends manuais aplicam cooldowns de 120, 240, 480, 600 e 600 segundos após cada envio confirmado.
- Resend respeita limite de 5 solicitações manuais por usuário em janela móvel de 24 horas.
- Estado ausente no Redis permite e inicializa; Redis indisponível retorna `503`.
- Cooldown, limite e mutação concorrente retornam tempo restante consistente no body e em `Retry-After`.
- Endpoint de status autenticado expõe disponibilidade, uso, restante, último envio e retry efetivo sem mutar o recurso.
- Intenções de verificação possuem `deliver_before` e não são enviadas quando não preservam cinco minutos úteis do token.
- Jobs vencidos tornam a intenção terminal antes de falhar de forma irrecuperável no BullMQ.
- Constantes centrais substituem configuração ambiental de cooldown e limite.
- Welcome email não é enviado em `user.created` para usuários pendentes.
- Welcome email é enviado após `user.email.verified`.
- Erros novos estão mapeados no filtro global e documentados.
- A migration adiciona exatamente uma coluna em `email_verification_challenges` e uma em `email_messages`, e `docs/database/schema.md` documenta ambas no mesmo conjunto de mudanças.
- Depois da migration, a imagem anterior que omite `origin` deve continuar criando challenges durante rollback; um default SQL temporário `LEGACY_UNKNOWN` deve permanecer até o contract registrado em `DB-COMPAT-001` ser liberado.
- Uma mutação manual deve renovar e comprovar a posse da barreira Redis depois de cada espera relevante dentro da transação; perda da posse ou falha de renovação deve causar rollback antes do commit.
- Todos os scripts Lua da feature possuem documentação de objetivo, chaves, argumentos, retorno, atomicidade, momento de chamada e falhas.
