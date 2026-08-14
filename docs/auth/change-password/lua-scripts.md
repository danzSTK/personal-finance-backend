---
area: auth
type: reference
status: current
related:
  - ./redis-keys.md
  - ./decisions/README.md
  - ./flow/README.md
---

# Scripts Lua da alteração de senha

Os scripts ficam em
`api/src/modules/auth/infrastructure/cache/scripts/` e são executados pelo
`RedisPasswordChangeStateStore`.

Lua foi escolhido porque cada operação precisa observar e modificar várias
chaves como uma única transição. Um pipeline reduziria round trips, mas não
impediria outro cliente de intercalar comandos entre leitura, limpeza e escrita.

## Garantia de atomicidade

Durante um script, o Redis não executa comandos de outro cliente no meio da
sequência. Para esta feature, isso garante que:

- uma leitura nunca veja metade da limpeza de janelas;
- duas requisições não adquiram a mesma barreira;
- `initialized` nunca anuncie uma projeção montada pela metade;
- uma operação antiga não remova a barreira pertencente a uma operação nova;
- todas as métricas relacionadas sejam substituídas juntas.

Todos os scripts devem permanecer curtos e sem I/O externo, pois o Redis fica
ocupado durante sua execução.

## `LOAD_PASSWORD_CHANGE_STATE_SCRIPT`

Arquivo: `load-password-change-state.script.ts`.

### Entradas

```text
KEYS[1] failures
KEYS[2] block
KEYS[3] block-recurrence
KEYS[4] changes
KEYS[5] initialized
KEYS[6] pending

ARGV[1] nowMs
ARGV[2] failureWindowMs
ARGV[3] completedWindowMs
```

### Passos

1. Verifica `pending` antes de qualquer outra chave.
2. Se existe mutação pendente, retorna seu PTTL.
3. Se não existe `initialized`, declara a projeção ausente.
4. Remove falhas e alterações fora das respectivas janelas.
5. Lê o fim do bloqueio e o início do último bloqueio relevante.
6. Conta as falhas restantes.
7. Retorna os scores das três alterações mais recentes.

### Retornos

| Retorno Lua                                                            | Resultado da store | Significado                                         |
| ---------------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| `{0}`                                                                  | `MISSING`          | A projeção precisa ser reconstruída pelo PostgreSQL |
| `{2, pendingPttlMs}`                                                   | `PENDING`          | Outra mutação está em andamento                     |
| `{1, blockedUntil, lastBlockStartedAt, failureCount, ...changeScores}` | `READY`            | Estado suficiente para a policy                     |

Strings vazias representam datas opcionais ausentes. Scores e instantes são
milissegundos Unix e são convertidos para `Date` na store.

## `BEGIN_PASSWORD_CHANGE_MUTATION_SCRIPT`

Arquivo: `replace-password-change-state.script.ts`.

### Entradas

```text
KEYS[1] initialized
KEYS[2] pending

ARGV[1] mutationToken
ARGV[2] pendingTtlMs
```

### Passos e retornos

O script executa:

```text
SET pending mutationToken NX PX pendingTtlMs
```

- se a aquisição falhar, retorna `{0, pendingPttlMs}`;
- se adquirir, remove `initialized` e retorna `{1, pendingTtlMs}`.

Remover `initialized` faz com que qualquer recuperação posterior reconstrua a
projeção em vez de reutilizar o snapshot anterior à transação.

## `REPLACE_PASSWORD_CHANGE_STATE_SCRIPT`

Arquivo: `replace-password-change-state.script.ts`.

### Entradas

```text
KEYS[1..6] as seis chaves da projeção

ARGV[1] payload JSON da projeção completa
ARGV[2] nowMs
ARGV[3] failureWindowMs
ARGV[4] completedWindowMs
ARGV[5] recurrenceWindowMs
ARGV[6] initializedTtlMs
ARGV[7] mutationToken ou string vazia
```

Payload:

```json
{
  "failedAttempts": [{ "eventId": "uuid", "occurredAtMs": 0 }],
  "completedChanges": [{ "eventId": "uuid", "occurredAtMs": 0 }],
  "blockedUntilMs": null,
  "lastBlockStartedAtMs": null
}
```

### Passos

1. Apaga `failures`, `block`, `block-recurrence`, `changes` e `initialized`.
2. Recria o ZSET de falhas e calcula TTL a partir da falha mais recente.
3. Recria o bloqueio ativo somente se ainda estiver no futuro.
4. Recria a reincidência somente se ainda estiver na janela de 24 horas.
5. Recria o ZSET de alterações e seu TTL.
6. Grava `initialized=1` com TTL de 25 horas.
7. Se recebeu `mutationToken`, remove `pending` apenas quando o valor atual é o
   mesmo token.
8. Retorna `1`.

### Por que substituir tudo

Falha, bloqueio, reincidência, cooldown e limite diário derivam do mesmo
histórico. Alterar apenas a chave aparentemente afetada exigiria caminhos de
compensação para crashes, retries duplicados, expiração parcial e eventos
processados fora de ordem.

O `replace` transforma o PostgreSQL em uma função de reconstrução:

```text
f(fatos duráveis, agora) = projeção Redis completa
```

Executar essa função novamente produz o mesmo estado lógico para os mesmos
fatos e instante. Isso simplifica o `finally`, a hidratação por cache miss e o
handler da outbox: todos usam exatamente o mesmo sincronizador.

## Script do limitador técnico

O `PasswordChangeCostGuard` possui um script Lua local para incrementar os
contadores por IP e JTI.

Para cada contador, ele executa `INCR`, define o TTL na primeira criação ou
quando encontra uma chave sem expiração e retorna contagem e PTTL das duas
dimensões. IP e JTI são avaliados juntos para que a resposta use o maior tempo
restante entre os limites violados.

Esse script é separado da projeção por usuário porque o limitador técnico tem
outra finalidade, outra disponibilidade e chaves baseadas em fingerprints
HMAC.
