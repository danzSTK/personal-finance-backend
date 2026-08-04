# Design — alteração de senha autenticada

## Referências

- [Documentação arquitetural](../../../../auth/change-password/architecture.md)
- [Fluxos detalhados](../../../../auth/change-password/flow/README.md)
- [Decisões arquiteturais](../../../../auth/change-password/decisions/README.md)
- [Desenho original](<../../../../Excalidraw/Drawing 2026-07-25 13.26.52.excalidraw.md>)

## Visão geral

O fluxo usa PostgreSQL como registro auditável e fonte de reconstrução, Redis
como projeção operacional de baixa latência e a outbox como fronteira resiliente
entre API e worker.

```text
HTTP + guards
  -> ChangeUserPasswordUseCase
       -> PasswordChangeStateLoader
            -> Redis projection
            -> PostgreSQL quando MISSING
       -> ChangePasswordPolicy
       -> Redis mutation barrier
       -> transação PostgreSQL
            -> lock users
            -> bcrypt
            -> password hash + credential_version
            -> password_change_events
            -> outbox_messages
       -> sincronização imediata Redis
       -> limpeza física de sessões
  -> limpa cookies

worker
  -> outbox
       -> reconcilia projeção Redis
       -> repete limpeza física de sessões
       -> publica fatos consumidos pela futura spec de e-mail
```

## Componentes e caminhos

### Domínio

- `api/src/modules/auth/domain/constants/password-change.constants.ts`
  centraliza janelas, limites, TTLs e limites de contexto.
- `api/src/modules/auth/domain/entities/password-change-event.entity.ts`
  representa um fato append-only e valida sua coerência.
- `api/src/modules/auth/domain/policies/change-password.policy.ts`
  recebe somente estado e relógio e decide bloqueio, cooldown, limite e duração
  de novo bloqueio.
- `api/src/modules/auth/domain/repositories/password-change-event.repository.interface.ts`
  abstrai o histórico persistido.
- `api/src/modules/auth/domain/events/` contém os quatro contratos de evento.
- `api/src/modules/users/domain/entities/user.entity.ts` mantém
  `credentialVersion`.
- `api/src/modules/users/domain/entities/credentials-auth-provider.entity.ts`
  troca o hash por comportamento explícito.

### Aplicação

- `api/src/modules/auth/application/use-cases/change-user-password/`
  orquestra o caso de uso e expõe DTO TypeScript simples.
- `api/src/modules/auth/application/ports/password-change-state-store.interface.ts`
  abstrai a projeção e a barreira Redis.
- `api/src/modules/auth/application/services/password-change-state-loader.ts`
  carrega Redis, hidrata do banco quando ausente e falha fechado quando o estado
  não pode ser garantido.
- `api/src/modules/auth/application/services/password-change-state.assembler.ts`
  transforma eventos em estado/projeção.
- `api/src/modules/auth/application/services/password-change-state-synchronizer.ts`
  reconstrói a projeção após commit e no worker.
- `api/src/modules/auth/application/errors/` contém erros independentes de HTTP.

### Infraestrutura

- `api/src/modules/auth/infrastructure/persistence/` contém ORM entity e
  repository de eventos.
- `api/src/modules/auth/infrastructure/mappers/password-change-event.mapper.ts`
  converte persistência e domínio.
- `api/src/modules/auth/infrastructure/cache/` implementa projeção, barreira e
  scripts Lua atômicos.
- `api/src/modules/auth/infrastructure/events/` reidrata eventos da outbox.
- `api/src/modules/auth/application/handlers/` contém handlers do worker para
  reconciliação e revogação física.
- `api/src/modules/users/infrastructure/persistence/` persiste
  `credential_version` e fornece leitura sem cache.

### Apresentação

- `api/src/modules/auth/presentation/dto/change-user-password.dto.ts` valida o
  body.
- `api/src/modules/auth/presentation/dto/change-user-password.response.dto.ts`
  serializa o sucesso.
- `api/src/modules/auth/presentation/guards/password-change-cost.guard.ts`
  aplica a proteção técnica.
- `api/src/modules/auth/presentation/http/auth.controller.ts` apenas extrai
  identidade/contexto, chama o use case, limpa cookies e serializa.
- `api/src/common/filters/app-exception.filter.ts` converte os erros e escreve
  `Retry-After`.

## Modelo PostgreSQL

### `password_change_events`

Tabela append-only com UUID, ownership por usuário, provider opcional para
preservar auditoria após remoção, tipo do fato, `blocked_until` apenas para
início de bloqueio, contexto sanitizado e instantes `timestamptz`.

O índice `(user_id, event_type, occurred_at DESC)` atende reconstrução das
janelas sem criar um índice GIN para metadata, que não participa de decisões.
O índice da FK `auth_provider_id` evita custo excessivo em remoções do provider.

### `users.credential_version`

Inteiro positivo, `NOT NULL DEFAULT 1`, incrementado dentro da mesma transação
que troca o hash. A versão é a autoridade durável para invalidar todos os JWTs
anteriores sem enumerar access tokens.

## Modelo Redis

Todas as chaves usam o hash tag `{<userId>}` para permanecerem no mesmo slot em
Redis Cluster e permitir scripts multi-key no futuro:

```text
auth:password-change:{userId}:failures          ZSET(eventId -> occurredAtMs)
auth:password-change:{userId}:block             STRING(blockedUntilMs)
auth:password-change:{userId}:block-recurrence  STRING(lastBlockStartedAtMs)
auth:password-change:{userId}:changes           ZSET(eventId -> occurredAtMs)
auth:password-change:{userId}:initialized       STRING(1)
auth:password-change:{userId}:pending           STRING(mutationToken)
```

Chaves técnicas:

```text
auth:password-change:cost:ip:{hmac}
auth:password-change:cost:session:{hmac}
```

`LOAD_PASSWORD_CHANGE_STATE_SCRIPT` remove membros expirados e retorna uma união
discriminada:

- `[0]`: `MISSING`;
- `[1, blockedUntil, lastBlockStartedAt, failureCount, ...changeScores]`:
  `READY`;
- `[2, pendingPttl]`: `PENDING`.

`BEGIN_PASSWORD_CHANGE_MUTATION_SCRIPT` usa `SET NX PX`, retorna aquisição e
PTTL e remove `initialized` somente quando adquire a barreira.

`REPLACE_PASSWORD_CHANGE_STATE_SCRIPT` substitui toda a projeção, configura TTLs,
recria `initialized` e remove `pending` somente se o token recebido ainda for o
dono.

O TTL de `initialized` é maior que a maior janela de decisão. Sua ausência força
reconstrução, portanto expiração ou perda de chave não autoriza a operação.

## Fluxo do use case

1. Carregar estado operacional.
2. Aplicar a policy; qualquer restrição termina antes de bcrypt.
3. Adquirir a barreira Redis.
4. Abrir transação e bloquear `users`.
5. Resolver o provider `EMAIL`.
6. Comparar a senha atual.
7. Se falhar:
   - persistir `CURRENT_PASSWORD_FAILED`;
   - decidir se deve iniciar bloqueio;
   - persistir o bloqueio e seus eventos de outbox quando aplicável;
   - retornar um resultado interno, sem lançar dentro da transação.
8. Se confirmar:
   - rejeitar igualdade com a nova senha;
   - calcular o novo hash;
   - alterar hash e incrementar `credentialVersion`;
   - persistir `PASSWORD_CHANGED` e os eventos de outbox.
9. Após o commit, reconstruir Redis usando o token da barreira.
10. Converter o resultado interno em sucesso ou erro de aplicação.
11. No sucesso, tentar remover sessões Redis; falha é registrada sem dados
    sensíveis e será repetida pelo worker.

Erros dentro da transação que exijam rollback são propagados. No `finally`, a
projeção é reconstruída a partir do banco para liberar a barreira com segurança;
se Redis estiver indisponível, o TTL da barreira garante recuperação.

## Transação e outbox

Os eventos usam deduplication keys baseadas no fato fonte:

```text
auth.password-change.state-refresh-requested:<passwordChangeEventId>
auth.password-change.changed:<passwordChangeEventId>
auth.password-change.block-started:<passwordChangeEventId>
auth.sessions.revoke-all-requested:<passwordChangeEventId>
```

O evento de mudança e o evento de bloqueio carregam apenas contexto já
sanitizado. O evento de refresh inclui o `mutationToken` apenas para coordenação
da projeção; o token é aleatório, curto e não é um JWT/JTI.

## Revogação durável

O `credentialVersion` entra nos access e refresh tokens. `JwtStrategy` e
`JwtRefreshStrategy` consultam `IUserRepository.findCredentialVersionById()`,
cuja implementação cached delega a leitura diretamente ao repository SQL.

```text
tokenVersion = payload.credentialVersion ?? 1
tokenVersion !== databaseVersion -> 401
```

Isso garante revogação lógica mesmo se a limpeza de sessões Redis falhar. A
remoção física reduz dados obsoletos e mantém a listagem de sessões correta.

## Resolução de IP e proxy

`resolveTrustedClientIp()` normaliza somente `request.ip` e, como fallback,
`socket.remoteAddress`. A aplicação não interpreta diretamente
`X-Forwarded-For`, `CF-Connecting-IP` ou `X-Real-IP`.

Em produção, `trust proxy = 1` pressupõe exatamente um proxy confiável que
sobrescreve os headers encaminhados. Outra topologia exige configuração
explícita antes do deploy.

## Tratamento de erros

`RetryAfterApplicationError` normaliza segundos positivos. O filtro global:

- seleciona o status pelo código;
- inclui `details`;
- define `Retry-After` quando o erro possui retry;
- nunca envia stack trace ou mensagem de Redis/PostgreSQL.

O CORS expõe somente o header adicional `Retry-After`.

## Disponibilidade

- Redis operacional indisponível: alteração bloqueada com `503`.
- Redis sem as chaves do usuário: reconstrução por PostgreSQL.
- Sincronização imediata falha após commit: a alteração permanece concluída,
  `credentialVersion` mantém tokens revogados e a outbox reconcilia o estado.
- Limpeza física falha: a outbox repete a revogação.
- Futuro provider de e-mail falha: não afeta esta transação; o consumidor será
  idempotente na spec de notificações.

## Observabilidade segura

Logs incluem somente código do erro e identificadores técnicos não secretos
quando necessários. Não são registrados body, senha, hash, cookie, JWT, JTI,
mutation token, HMAC original, IP cru ou User-Agent cru.
