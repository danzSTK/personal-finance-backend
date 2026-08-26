---
area: auth
feature: email-verification
type: spec-decisions
status: current
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

## DEC-008 - Limite de 5 e-mails por 24 horas incluía envio automático

Status: superseded by DEC-017

Historical decision:
O primeiro envio automático criado por `user.created` contava no limite de 5 em
24 horas para o mesmo `email + purpose`.

Reason:
O limite é sobre volume de e-mails enviados para o destinatário, independentemente da origem do envio.

Historical impact:
Depois do envio automático, restavam no máximo 4 resends na janela móvel de 24
horas.

Supersession:
Esta regra não integra o desenho atual. DEC-017 preserva o automático no
cooldown, mas retira esse envio do limite manual.

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

## DEC-015 - Redis é a autoridade operacional da política de resend

Status: accepted

Decision:
Cooldown, contagem de reenvios manuais, último envio lógico e barreira de
mutação passam a ser avaliados no Redis por `userId`. A tabela de challenges
deixa de ser consultada para decidir cooldown ou limite diário.

Reason:
Esses dados são temporais, possuem expiração natural e precisam retornar PTTL
com baixa latência. `email_verification_challenges` representa autorização por
token, não um rate limiter operacional.

Alternatives considered:

- Continuar contando challenges no PostgreSQL: simples, mas mistura
  responsabilidades e não fornece TTL diretamente.
- Persistir somente contadores fixos: não representa corretamente uma janela
  móvel de 24 horas.

Impact:
Exige store Redis, chaves centralizadas, scripts Lua, testes com Redis real e
contrato explícito para falhas entre Redis e PostgreSQL.

## DEC-016 - Estado ausente é fail-open e Redis indisponível é fail-closed

Status: accepted

Decision:
Ausência total ou parcial das chaves do usuário representa estado vazio e
permite a operação. Erro de conexão, timeout ou resposta Redis inválida retorna
`503 EMAIL_VERIFICATION_STATE_UNAVAILABLE` antes de uma mutação manual.

Reason:
O resend não é crítico o suficiente para exigir reconstrução do estado em cada
cache miss, mas indisponibilidade não pode ser confundida com ausência. Liberar
durante outage poderia persistir várias intenções que seriam enviadas em rajada
quando BullMQ retornasse.

Alternatives considered:

- Hidratar pelo PostgreSQL: preserva limites, porém recoloca consultas de janela
  no caminho quente e aumenta complexidade operacional.
- Fail-open também em indisponibilidade: maior disponibilidade, com risco de
  abuso e rajada de e-mails reconciliados.

Impact:
Perda de chaves pode reiniciar cooldown e contagem. Esse comportamento deve ser
testado, documentado e monitorado.

## DEC-017 - Automático inicia cooldown e não entra no limite manual

Status: accepted

Decision:
O envio automático inicial gera cooldown de 60 segundos, mas não é inserido no
contador de cinco reenvios manuais da janela móvel de 24 horas.

Reason:
O usuário não escolheu consumir o envio inicial. Ainda assim, o cooldown evita
um resend imediato enquanto o primeiro job está em trânsito.

Impact:
Depois do automático, o usuário mantém cinco resends manuais. A decisão anterior
DEC-008 foi substituída.

## DEC-018 - Cooldown exponencial limitado usa constantes centrais

Status: accepted

Decision:
O automático produz 60 segundos. Depois de cada manual confirmado, usar
`min(60 * 2 ^ manualResendsUsedAfterSend, 600)`, resultando em 120, 240, 480,
600 e 600 segundos. Limite 5, janela 86.400 segundos, cooldown inicial 60,
máximo 600 e janela útil mínima 300 ficam em constantes centrais, não em
variáveis de ambiente.

Reason:
Esses valores controlam consumo de recurso e comportamento de produto. Mudá-los
deve exigir diff, revisão e atualização da spec, em vez de alteração operacional
silenciosa por ambiente.

Alternatives considered:

- Cooldown fixo: não aumenta fricção progressiva para uso repetido.
- Cooldown sem teto: pode superar o TTL e deixar o usuário sem link utilizável.
- Variáveis de ambiente: flexíveis, mas permitem divergência não versionada.

Impact:
Remover `EMAIL_VERIFICATION_RESEND_COOLDOWN_MINUTES` e
`EMAIL_VERIFICATION_DAILY_LIMIT`. O TTL configurado do token deve respeitar a
invariante de 900 segundos com os valores atuais.

## DEC-019 - Persistir a origem do challenge

Status: accepted

Decision:
Adicionar `email_verification_challenges.origin` com `AUTOMATIC`,
`MANUAL_RESEND` e `LEGACY_UNKNOWN`. Novos challenges usam somente as duas
primeiras origens; legado é preenchido na migration.

Reason:
Origem é procedência do fato, útil para auditoria, idempotência e diagnóstico,
sem transformar a tabela em contador temporal.

Alternatives considered:

- Manter origem somente no Redis: perde contexto após expiração ou perda de
  chaves.
- Inferir pela ordem dos challenges: ambíguo e incorreto sob retries.

Impact:
Exige uma nova coluna, check constraint, mapper, domínio e índice partial unique
que impeça dois challenges automáticos por usuário/purpose.

## DEC-020 - Escopo Redis por userId

Status: accepted

Decision:
As chaves da política usam `userId` e a hash tag `{userId}`.

Reason:
Resend e status são autenticados e pertencem à conta. `userId` evita PII na chave
e mantém todas as chaves do usuário no mesmo slot para scripts Redis Cluster.

Impact:
O limite deixa de ser compartilhado por texto de e-mail entre contas distintas.
Troca/reuso de endereço continua fora do escopo da feature.

## DEC-021 - Reserva Redis precede o commit e projeção só registra fatos confirmados

Status: accepted

Decision:
Um script atômico avalia restrições e adquire `pending` antes da transação. O
contador e o cooldown só são atualizados depois que challenge e intenção forem
confirmados no PostgreSQL. Rollback executa compare-and-delete e TTL é fallback.

Reason:
A barreira impede concorrência; atualizar contadores antes do commit criaria
envios fantasmas se a transação falhasse.

Impact:
Falha depois do commit e antes da finalização Redis pode deixar a projeção
atrasada. A API preserva `202`, a barreira expira e a política fail-open aceita
esse risco raro.

## DEC-022 - deliver_before é um prazo genérico de entrega

Status: accepted

Decision:
Adicionar `email_messages.deliver_before timestamptz null`. Para verification,
persistir `challenge.expiresAt - 300 segundos`; `null` mantém o comportamento de
mensagens sem deadline.

Reason:
O conceito pode ser reutilizado por outras notificações e permite que o worker
decida localmente, sem dependência circular de notifications para auth. Verificar
somente `expiresAt > now` ainda poderia enviar um token com poucos segundos úteis.

Alternatives considered:

- Consultar o challenge no worker: exige relacionamento explícito e acopla
  notifications a auth.
- Extrair challenge id da idempotency key: usa uma string operacional como
  relacionamento e é frágil.

Impact:
Exige uma coluna nullable e uma constraint em `email_messages`, além de alterações
na entidade, mapper, repository e criação da intenção.

## DEC-023 - Deadline vencido cancela a intenção e falha o job sem retry

Status: accepted

Decision:
Quando `deliver_before <= now`, marcar `email_messages` como `CANCELED` antes de
retornar um resultado terminal. O processor lança `UnrecoverableError` para o
BullMQ mover o job a failed sem usar as tentativas restantes.

O instante deve ser lido depois da aquisição do lock. Intenções com deadline são
revalidadas sob um novo lock imediatamente antes do provider, pois o preparo ou a
espera transacional podem atravessar `deliver_before`. Depois do commit dessa
revalidação, uma última leitura antecede `MailService.send`; se o prazo cruzou, o
cancelamento volta ao lock. A chamada externa nunca mantém a transação aberta.

Reason:
Não houve falha do provider; a mensagem perdeu utilidade. O estado SQL terminal
impede o reconciliador de reenfileirar, enquanto o estado failed no BullMQ dá
visibilidade operacional.

Impact:
O caso de uso não importa BullMQ. Erro e logs devem ser sanitizados e nunca conter
URL, token ou template params.

## DEC-024 - Expor status do resend para sincronização do frontend

Status: accepted

Decision:
Criar `GET /auth/email-verification/resend/status`, autenticado. O endpoint retorna
`200` com formas `AVAILABLE`, `BLOCKED` ou `ALREADY_VERIFIED`; quando bloqueado,
repete o mesmo valor em `retryAfterSeconds` e `Retry-After` e usa
`Cache-Control: no-store`.

As formas `AVAILABLE` e `ALREADY_VERIFIED` preservam o campo
`retryAfterSeconds` explicitamente como `null`; somente a forma `BLOCKED` usa um
inteiro positivo e emite o header.

Reason:
O frontend precisa bloquear consumo inválido e sincronizar seu contador local sem
executar um resend apenas para descobrir a restrição.

Impact:
Exige use case de leitura, três response DTOs com `object` próprio, Swagger,
documentação de integração e testes de body/header. Polling contínuo por segundo
não faz parte do contrato recomendado.

## DEC-025 - Documentar individualmente todos os scripts Lua

Status: accepted

Decision:
Cada script Lua deve possuir documentação com objetivo, chaves, argumentos,
retornos, transição atômica, momento de chamada, idempotência e falhas.

Reason:
Scripts executam transições multi-key fora do type checker TypeScript. O contrato
documentado reduz risco de alterar posições de `KEYS`/`ARGV` ou interpretar
retornos incorretamente.

Impact:
`docs/auth/email-verification/lua-scripts.md` é parte obrigatória da entrega e
deve evoluir junto dos scripts.

## DEC-026 - Prioridade de e-mails fica fora desta feature

Status: accepted

Decision:
Não alterar prioridades BullMQ na issue 76.

Reason:
Prioridade afeta todos os tipos de notificação, producer, reconciliador e risco de
starvation. É uma capacidade transversal que merece feature e critérios próprios.

Impact:
Todos os jobs continuam sem prioridade explícita nesta entrega.

## DEC-027 - Estados da feature usam const objects tipados

Status: accepted

Decision:
Centralizar `AVAILABLE`, `BLOCKED`, `ALREADY_VERIFIED`, `QUEUED` e `ACQUIRED`
em `EmailVerificationResendStatus` e `EmailVerificationResendMutationKind`. Porta,
adapter, use cases, DTOs e controller usam os valores e tipos derivados desses
objetos, sem repetir magic strings.

Reason:
Esses valores formam o vocabulário estável do fluxo e participam de uniões
discriminadas e do contrato HTTP. Literais espalhados permitem divergência entre
camadas e dificultam refactors seguros.

Impact:
As strings aparecem diretamente apenas na declaração central e nos exemplos de
documentação. Novos estados exigem uma alteração explícita no catálogo tipado.
