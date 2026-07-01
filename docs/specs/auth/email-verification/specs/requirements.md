---
area: auth
feature: email-verification
type: spec-requirements
status: accepted
related:
  - ../../../../auth/flows/sign-up.md
  - ../../../../auth/flows/sign-in.md
  - ../../../../auth/flows/google-login.md
  - ../../../../auth/reference/endpoints.md
  - ../../../../events/user-created.md
  - ../../../../notifications/README.md
  - ../../../../database/schema.md
---

# Requirements - Email Verification

## Objetivo

Introduzir confirmação de e-mail para contas criadas por credenciais sem impedir login inicial, mas bloqueando por padrão o acesso aos recursos do produto enquanto o usuário estiver com e-mail pendente.

O fluxo deve criar desafios de verificação por token, enviar e-mails transacionais, permitir confirmação via `POST`, permitir reenvio autenticado com cooldown e limite diário, e disparar o e-mail de boas-vindas somente depois que contas credentials forem verificadas.

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
- cooldown de 60 minutos para reenvio;
- limite de 5 e-mails de verificação por e-mail em janela móvel de 24 horas, incluindo o envio automático inicial;
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

Rotas públicas continuam públicas. A confirmação é pública porque o token completo chega pela URL do frontend e o frontend envia o token por `POST` ao backend.

### Challenge e token

- Cada challenge deve ter purpose `EMAIL_VERIFICATION`.
- O token completo deve ser enviado somente no link do e-mail.
- O banco deve armazenar apenas `token_hash`, nunca o token em claro.
- O token deve expirar 15 minutos após criação.
- Challenge consumido deve preencher `consumed_at`.
- Um challenge expirado ou consumido não deve confirmar usuário pendente.
- Confirmação deve ser feita por `POST`, não por `GET`, para evitar confirmação por prefetch, crawler ou fake view.

### Envio automático

- Quando `user.created` for processado para usuário `PENDING_EMAIL_VERIFICATION`, o sistema deve criar challenge e enviar e-mail de verificação.
- O envio automático inicial conta no limite de 5 e-mails por 24 horas.
- Quando `user.created` for processado para usuário que não está pendente, o sistema não deve enviar e-mail de verificação.
- Quando `user.created` for processado para usuário `PENDING_EMAIL_VERIFICATION`, o sistema não deve enviar welcome email.
- Quando `user.created` for processado para usuário que não está pendente, o sistema pode enviar welcome email pelo fluxo atual.

### Reenvio

- Reenvio exige usuário autenticado.
- Reenvio deve usar o usuário autenticado, nunca `userId` ou `email` do body.
- Reenvio só é permitido se o usuário autenticado estiver `PENDING_EMAIL_VERIFICATION`.
- Reenvio deve respeitar cooldown de 60 minutos desde o último challenge criado para o mesmo `email + purpose`.
- Reenvio deve respeitar limite máximo de 5 challenges criados para o mesmo `email + purpose` nos últimos 24 horas.
- Quando o usuário já estiver `ACTIVE`, reenvio deve retornar sucesso idempotente sem criar novo challenge nem enviar e-mail.

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

### REQ-014 - Aplicar cooldown

IF já existir challenge `EMAIL_VERIFICATION` para o mesmo e-mail criado há menos de 60 minutos
THEN o resend deve falhar com `EMAIL_VERIFICATION_COOLDOWN_ACTIVE`.

### REQ-015 - Aplicar limite diário

IF já existirem 5 challenges `EMAIL_VERIFICATION` para o mesmo e-mail nos últimos 24 horas
THEN o resend deve falhar com `EMAIL_VERIFICATION_DAILY_LIMIT_EXCEEDED`.

### REQ-016 - Nao enumerar e-mails no resend

WHEN o resend for chamado
THE SYSTEM SHALL derivar o e-mail do usuário autenticado e não aceitar e-mail arbitrário no body.

### REQ-017 - Não persistir token em claro

WHEN um challenge for persistido
THE SYSTEM SHALL armazenar apenas `token_hash`.

### REQ-018 - Documentar contrato

WHEN a feature for implementada
THE SYSTEM SHALL atualizar docs de auth, integrations, events, notifications e database schema.

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
  THEN apenas um deve criar challenge quando ambos disputarem cooldown/limite.

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
- Resend respeita cooldown de 60 minutos.
- Resend respeita limite de 5 e-mails por e-mail em 24 horas, incluindo envio automático inicial.
- Welcome email não é enviado em `user.created` para usuários pendentes.
- Welcome email é enviado após `user.email.verified`.
- Erros novos estão mapeados no filtro global e documentados.
- `docs/database/schema.md` documenta a nova tabela e alteração do status.
