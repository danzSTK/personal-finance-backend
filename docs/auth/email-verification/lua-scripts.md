---
area: auth
feature: email-verification
type: reference
status: proposed
related:
  - ./index.md
  - ./redis-keys.md
  - ../../specs/auth/email-verification/specs/design.md
---

# Scripts Lua Do Reenvio De Verificação

## Garantias Comuns

Os scripts executam transições atômicas sobre chaves no mesmo hash slot. Eles
devem ser curtos, determinísticos e sem I/O externo.

Regras comuns:

- `nowMs` é recebido da aplicação para permitir testes determinísticos;
- janelas e TTLs chegam por `ARGV` a partir de constantes centrais;
- valores em milissegundos são inteiros;
- PTTL positivo é convertido pelo adapter com `max(1, ceil(pttl / 1000))`;
- PTTL `-2` significa chave ausente;
- PTTL `-1`, arrays inesperados ou valores inválidos são falha técnica;
- nenhum retorno contém token, e-mail, URL, template params ou mutation token;
- o adapter valida o contrato antes de produzir tipos de aplicação.

## LOAD_EMAIL_VERIFICATION_RESEND_STATE_SCRIPT

### Quando É Chamado

Chamado por `GetEmailVerificationResendStatusUseCase` para usuário
`PENDING_EMAIL_VERIFICATION`. Usuário `ACTIVE` retorna `ALREADY_VERIFIED` sem
executar o script.

### Objetivo

Ler uma visão coerente do contador, último envio, cooldown e mutação concorrente
sem alterar o consumo do recurso. A única mutação permitida é a limpeza de
membros vencidos e TTLs sem utilidade.

### KEYS

```text
KEYS[1] manual-resends
KEYS[2] cooldown
KEYS[3] last-send
KEYS[4] pending
```

### ARGV

```text
ARGV[1] nowMs
ARGV[2] manualWindowMs        # 86_400_000
ARGV[3] manualResendLimit     # 5
```

### Transição Atômica

1. Executa `ZREMRANGEBYSCORE manual-resends -inf nowMs-windowMs`.
2. Lê `ZCARD` e o score manual mais antigo.
3. Lê `PTTL cooldown` e `PTTL pending`.
4. Quando a contagem atingiu cinco, calcula
   `oldestScore + windowMs - nowMs`.
5. Seleciona a maior espera positiva entre cooldown, limite e pending.
6. Lê `last-send` e valida que seja JSON sanitizado.
7. Retorna disponibilidade, restrição efetiva, espera, contagem e último envio.

### Retorno Lógico

```text
AVAILABLE:
  [0, manualCount, remaining, lastSendJsonOrEmpty]

BLOCKED:
  [1, restrictionCode, retryAfterMs, manualCount, remaining, lastSendJsonOrEmpty]
```

`restrictionCode`:

```text
1 = COOLDOWN
2 = DAILY_LIMIT
3 = OPERATION_PENDING
```

Empates usam precedência `OPERATION_PENDING`, `DAILY_LIMIT`, `COOLDOWN` apenas
para estabilidade do campo `blockedBy`; `retryAfterMs` continua sendo o maior.

### Chaves Ausentes E Falhas

Todas ausentes retornam `AVAILABLE`, zero usados, cinco restantes e último envio
vazio. Retorno malformado ou PTTL sem expiração faz o adapter lançar
`EMAIL_VERIFICATION_STATE_UNAVAILABLE`.

## BEGIN_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT

### Quando É Chamado

Chamado por `ResendEmailVerificationUseCase` depois de validar que o usuário está
pendente e antes de abrir a transação PostgreSQL.

### Objetivo

Avaliar todas as restrições e adquirir a barreira manual na mesma execução,
eliminando a janela entre check e `SET NX`.

### KEYS

```text
KEYS[1] manual-resends
KEYS[2] cooldown
KEYS[3] pending
```

### ARGV

```text
ARGV[1] nowMs
ARGV[2] manualWindowMs
ARGV[3] manualResendLimit
ARGV[4] mutationToken
ARGV[5] mutationTtlMs          # 30_000
```

### Transição Atômica

1. Remove membros manuais vencidos.
2. Calcula cooldown, limite diário e pending existentes.
3. Se alguma restrição estiver ativa, retorna a maior espera sem criar chave.
4. Caso contrário, executa `SET pending mutationToken NX PX mutationTtlMs`.
5. Como toda a avaliação ocorre no script, a aquisição deve ter sucesso; falha
   inesperada é retornada como pending com seu PTTL.

### Retorno Lógico

```text
ACQUIRED:
  [0, manualCount]

BLOCKED:
  [1, restrictionCode, retryAfterMs, manualCount]
```

O mutation token nunca volta no array; o chamador já possui seu valor local.

### Efeito Posterior

`ACQUIRED` autoriza iniciar a transação, não consome contador e não inicia
cooldown. Somente o complete após commit registra o envio lógico.

## COMPLETE_EMAIL_VERIFICATION_LOGICAL_SEND_SCRIPT

### Quando É Chamado

Chamado depois do commit PostgreSQL que persistiu challenge e intenção:

- pelo resend manual, com mutation token;
- pelo handler automático, sem mutation token.

Também pode ser repetido para recuperar uma falha depois do commit.

### Objetivo

Registrar um envio lógico confirmado, calcular o próximo cooldown com o instante
original e liberar somente a barreira pertencente à operação.

### KEYS

```text
KEYS[1] manual-resends
KEYS[2] cooldown
KEYS[3] last-send
KEYS[4] pending
```

### ARGV

```text
ARGV[1] nowMs
ARGV[2] origin                  # AUTOMATIC | MANUAL_RESEND
ARGV[3] challengeId
ARGV[4] logicalSendAtMs
ARGV[5] manualWindowMs
ARGV[6] initialCooldownMs       # 60_000
ARGV[7] maxCooldownMs           # 600_000
ARGV[8] mutationTokenOrEmpty
```

### Transição Atômica

1. Remove membros manuais vencidos.
2. Para `MANUAL_RESEND`, executa
   `ZADD manual-resends NX logicalSendAtMs challengeId`.
3. Conta os manuais após o `ZADD`.
4. Para automático, usa 60 segundos; para manual, usa
   `min(60s * 2 ^ manualCount, 600s)`.
5. Calcula `cooldownUntilMs = logicalSendAtMs + cooldownMs` e grava somente o
   tempo restante. Reprocessamento não reinicia o relógio.
6. Não substitui um cooldown existente cujo fim seja posterior.
7. Atualiza `last-send` somente quando o instante não é anterior ao armazenado.
8. Ajusta o TTL do ZSET até o membro mais novo sair da janela e o TTL de
   `last-send` até 24 horas após o envio lógico.
9. Se recebeu mutation token, remove `pending` apenas se o valor atual confere.

### Retorno Lógico

```text
[0, manualCount, cooldownUntilMs, cooldownRemainingMs]
```

### Idempotência E Falhas

- `ZADD NX` impede contar o mesmo challenge manual duas vezes.
- O unique partial no PostgreSQL impede dois automáticos para o mesmo
  usuário/purpose.
- Se a chamada falhar, o commit SQL permanece válido; a API não converte um
  resend já confirmado em erro. A barreira expira e a regra fail-open se aplica.

## ABORT_EMAIL_VERIFICATION_RESEND_MUTATION_SCRIPT

### Quando É Chamado

Chamado no caminho de erro quando a barreira foi adquirida, mas a transação não
confirmou challenge e intenção. Pode ser executado em `catch/finally`.

### Objetivo

Liberar rapidamente a mutação sem permitir que uma operação atrasada remova a
barreira criada por outra requisição.

### KEYS

```text
KEYS[1] pending
```

### ARGV

```text
ARGV[1] mutationToken
```

### Transição Atômica

1. Lê o valor atual de `pending`.
2. Se for igual ao mutation token, executa `DEL` e retorna removido.
3. Se estiver ausente ou pertencer a outra operação, não altera e retorna não
   removido.

### Retorno Lógico

```text
[1] # barreira removida
[0] # ausente ou outro dono
```

### Falhas

Falha de Redis durante abort é registrada sem mutation token. O TTL de 30
segundos é a recuperação final e impede bloqueio permanente.

## Matriz De Chamadas

| Fluxo                 | load     | begin | complete     | abort       |
| --------------------- | -------- | ----- | ------------ | ----------- |
| GET status pendente   | sim      | não   | não          | não         |
| POST resend permitido | não      | sim   | após commit  | em rollback |
| POST resend bloqueado | não      | sim   | não          | não         |
| envio automático      | não      | não   | após commit  | não         |
| retry após commit SQL | opcional | não   | pode repetir | não         |

## Testes Obrigatórios

- chaves ausentes;
- limites exatos de PTTL e janela móvel;
- maior restrição e desempate estável;
- duas chamadas begin concorrentes;
- complete manual repetido;
- complete automático sem ZSET;
- complete atrasado sem reiniciar cooldown;
- complete automático sem encurtar cooldown manual;
- abort do dono e de token antigo;
- retorno malformado e PTTL sem expiração;
- compatibilidade de hash slot entre todas as chaves.
