---
area: auth
feature: email-verification
type: spec-decisions
status: accepted
related:
  - ./requirements.md
  - ./design.md
  - ./tasks.md
---

# Decisions - Email Verification

## DEC-001 - Usar status dedicado para e-mail pendente

Status: accepted

Decision:
Adicionar `PENDING_EMAIL_VERIFICATION` em vez de reaproveitar `PENDING_PROFILE`.

Reason:
`PENDING_PROFILE` expressa perfil incompleto, enquanto verificação de e-mail é uma garantia de identidade/contato. Misturar os dois estados deixaria OAuth, onboarding e autorização ambíguos.

Impact:
Exige alteração de enum, check constraint, docs, testes e regras de autorização.

## DEC-002 - Usuário credentials pode logar antes de verificar e-mail

Status: accepted

Decision:
O sign-up por credenciais continua criando sessão e cookies, mesmo com status `PENDING_EMAIL_VERIFICATION`.

Reason:
O frontend precisa reconhecer o usuário, ler `status` em `GET /users/me` e conduzir a UX de verificação sem criar um fluxo separado de sessão temporária.

Impact:
Exige guard deny-by-default para bloquear recursos do produto enquanto permite rotas essenciais.

## DEC-003 - OAuth Google fica fora desta mudança

Status: accepted

Decision:
Não alterar status, sessão ou provider do fluxo Google OAuth nesta feature.

Reason:
Esta feature foi aprovada para o fluxo credentials. O comportamento de OAuth tem regras próprias e será avaliado depois.

Impact:
Implementação não deve modificar `OAuthCallbackUseCase`, guards/strategies do Google ou docs específicas de OAuth, exceto se necessário para declarar que o fluxo ficou fora do escopo.

## DEC-004 - Bloqueio por guard global e liberação por decorator

Status: accepted

Decision:
Criar guard global para bloquear `PENDING_EMAIL_VERIFICATION` em rotas protegidas, com decorator `@AllowPendingEmailVerification()` para exceções.

Reason:
O padrão deny-by-default reduz risco de esquecer bloqueio em novos módulos. O decorator deixa explícitas as rotas necessárias para UX/autenticação.

Impact:
Rotas como `GET /users/me`, logout e resend precisam ser marcadas explicitamente.

## DEC-005 - Confirmação pública por POST

Status: accepted

Decision:
`POST /auth/email-verification/confirm` será público e receberá o token no body.

Reason:
O link chega no frontend por URL, mas confirmação via `POST` evita confirmação por prefetch, crawler, preview ou simples visualização do link.

Impact:
Frontend deve extrair o token da URL e enviar uma chamada explícita ao backend.

## DEC-006 - Resend autenticado

Status: accepted

Decision:
`POST /auth/email-verification/resend` exige sessão autenticada e usa o usuário atual como destinatário.

Reason:
Isso evita endpoint público de spam e evita aceitar e-mail arbitrário no body.

Impact:
Usuário precisa estar logado para reenviar. O guard deve liberar essa rota para status pendente.

## DEC-007 - Token expira em 15 minutos

Status: accepted

Decision:
Challenges `EMAIL_VERIFICATION` expiram 15 minutos após criação.

Reason:
O link é poderoso o suficiente para ativar uma conta, então o tempo de validade deve ser curto.

Impact:
O resend precisa ser simples e confiável para recuperar UX quando o token expirar.

## DEC-008 - Limite de 5 e-mails por 24 horas inclui envio automático

Status: accepted

Decision:
O primeiro envio automático criado por `user.created` conta no limite de 5 em 24 horas para o mesmo `email + purpose`.

Reason:
O limite é sobre volume de e-mails enviados para o destinatário, independentemente da origem do envio.

Impact:
Depois do envio automático, restam no máximo 4 resends na janela móvel de 24 horas.

## DEC-009 - Challenge separado de email_messages

Status: accepted

Decision:
Criar `email_verification_challenges` em vez de tentar representar token/cooldown em `email_messages`.

Reason:
`email_messages` representa intenção e estado de envio. Challenge representa autorização por token, expiração e consumo. Unir os dois misturaria responsabilidades e dificultaria reuso por `purpose`.

Impact:
Nova tabela, repository e migration.

## DEC-010 - Armazenar apenas hash do token

Status: accepted

Decision:
Persistir `sha256(token)` como `token_hash` e nunca salvar token em claro.

Reason:
Reduz impacto de vazamento do banco. Como o token é aleatório e de alta entropia, hash determinístico é suficiente para lookup.

Impact:
Não é possível reenviar o mesmo token; cada resend cria novo challenge.

## DEC-011 - Welcome por evento user.email.verified

Status: accepted

Decision:
Enviar welcome email para usuários credentials após `user.email.verified`, não chamando producer diretamente no use case de confirmação.

Reason:
Mantém o padrão de outbox/eventos para efeitos cross-module e preserva idempotência do welcome email.

Impact:
Precisa criar novo evento, hydrator e handler em notifications.

## DEC-012 - Verification email idempotente por challenge

Status: accepted

Decision:
Usar idempotency key `email:verification:challenge:<challengeId>` para o e-mail de verificação.

Reason:
Resend precisa enviar novos e-mails para o mesmo usuário. Idempotência por usuário impediria reenvios legítimos.

Impact:
Cada challenge pode gerar no máximo uma intenção de envio, mas usuários podem ter múltiplos challenges controlados por cooldown/limite.

## DEC-013 - Email verification usa o VO compartilhado de e-mail

Status: accepted

Decision:
`EmailVerificationChallenge.email` deve validar e normalizar pelo value object compartilhado `Email`, usado também pelo módulo de usuários.

Reason:
O challenge confirma o e-mail principal da plataforma. Regras paralelas poderiam aceitar estado inválido ou divergente do usuário.

Impact:
O VO foi movido para `common/domain/value-objects`, o caminho antigo em users ficou como re-export temporário, e a coluna `email_verification_challenges.email` foi alinhada para `varchar(255)`.

## DEC-014 - AuthController é liberado para usuário pendente

Status: accepted

Decision:
Aplicar `@AllowPendingEmailVerification()` no `AuthController`, não apenas em métodos específicos.

Reason:
As rotas de auth e sessão são essenciais para usuários `PENDING_EMAIL_VERIFICATION`. O usuário pendente precisa conseguir reenviar verificação, renovar sessão, encerrar sessão e acessar operações de autenticação sem receber `EMAIL_VERIFICATION_REQUIRED`.

Impact:
O bloqueio por e-mail pendente continua valendo para recursos de produto. No módulo `auth`, a regra de negócio específica de cada endpoint ainda decide o que faz sentido para usuário pendente.
