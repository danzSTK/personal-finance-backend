# Decisões — alteração de senha autenticada

## D1 — Redis operacional, PostgreSQL auditável

**Decisão:** Redis fornece as métricas e TTLs usados no caminho quente.
PostgreSQL registra os fatos e reconstrói a projeção após perda/expiração.

**Motivo:** evita recalcular janelas em toda tentativa sem transformar a perda
de uma chave em autorização implícita.

**Consequência:** Redis indisponível bloqueia temporariamente a operação; chave
ausente é um estado recuperável pelo banco.

## D2 — sem `OPERATION_BLOCKED` genérico

**Decisão:** persistir `FAILED_ATTEMPTS_BLOCK_STARTED` somente quando as falhas
iniciam um bloqueio.

**Motivo:** cooldown e limite diário são decisões derivadas de
`PASSWORD_CHANGED`; criar um evento genérico misturaria causas diferentes e
complicaria auditoria.

## D3 — quinta falha retorna 429

**Decisão:** a quinta falha persiste a falha e o início do bloqueio e responde
`PASSWORD_CHANGE_BLOCKED` com retry.

**Motivo:** o estado produzido pela própria requisição já é um bloqueio ativo e
o cliente recebe imediatamente o tempo correto.

## D4 — barreira Redis e lock SQL

**Decisão:** usar `SET NX PX` por usuário antes do bcrypt e
`pessimistic_write` na linha de usuário dentro da transação.

**Motivo:** a barreira limita custo e coordena a projeção; o lock SQL preserva o
último ponto de autoridade do hash e da versão mesmo diante de falhas de
processo.

## D5 — fatos persistidos antes de projeções

**Decisão:** PostgreSQL é gravado primeiro; Redis é atualizado somente após
commit.

**Motivo:** uma projeção Redis nunca pode afirmar que uma falha ou alteração
aconteceu se a transação correspondente foi revertida.

## D6 — resultados internos para falhas de senha

**Decisão:** senha incorreta retorna um resultado interno da transação; o erro
HTTP é lançado somente depois do commit.

**Motivo:** lançar dentro da callback da transação faria rollback dos eventos de
falha e permitiria tentativas ilimitadas.

## D7 — `credentialVersion` para revogação lógica

**Decisão:** adicionar uma versão positiva ao usuário, incluí-la nos JWTs e
consultá-la sem cache em access e refresh.

**Motivo:** o sistema atual enumera refresh sessions, mas não todos os access
tokens. A versão invalida ambos imediatamente e continua correta se Redis
falhar.

**Compatibilidade:** claim ausente equivale a versão `1`. Após a primeira
mudança, o banco passa a `2` e invalida tokens anteriores.

## D8 — limpeza física assíncrona e idempotente

**Decisão:** tentar `revokeAllSessions` após commit e também publicar um evento
de outbox consumido pelo worker.

**Motivo:** limpeza Redis melhora higiene e listagem, mas não pode fazer rollback
da senha. A segurança imediata vem de `credentialVersion`.

## D9 — eventos de notificação sem envio nesta feature

**Decisão:** persistir e publicar `auth.password-change.changed` e
`auth.password-change.block-started`; templates, `email_messages`, BullMQ e
provider pertencem a outra spec.

**Motivo:** mantém a transação de segurança independente do provider de e-mail
e estabelece o contrato necessário entre API, worker e notificações.

**Processamento local:** enquanto não houver handlers, o publicador assíncrono
rejeita esses eventos, a outbox executa suas tentativas e os move para `DEAD`.
Como a feature ainda não possui dados fora do ambiente local, a futura spec de
e-mail não fará backfill nem replay retroativo desses registros; eventos locais
anteriores poderão ser descartados com o estado de desenvolvimento.

## D10 — proteção técnica não substitui policy

**Decisão:** aplicar limites por IP/sessão em guard e limites por usuário no use
case.

**Motivo:** o guard reduz bcrypt abusivo; a policy preserva a regra de negócio
mesmo quando o limitador técnico estiver indisponível.

## D11 — fingerprints HMAC

**Decisão:** IP e sessão não aparecem diretamente nas chaves de custo.

**Motivo:** reduz exposição operacional e impede que identificadores sensíveis
sejam reconhecidos em inspeções do keyspace. Um HMAC impede ataque de dicionário
sem o segredo.

## D12 — confiança de proxy explícita

**Decisão:** resolver IP por `request.ip`, com `trust proxy` alinhado à topologia.

**Motivo:** ler headers encaminhados diretamente permite spoofing quando o
último proxy não os sobrescreve corretamente.

## D13 — `noeviction`

**Decisão:** o Redis operacional usa AOF e `maxmemory-policy noeviction`.

**Motivo:** eviction silenciosa de chaves de estado de segurança aumentaria
reconstruções e poderia degradar disponibilidade. Ao atingir memória, writes
falham explicitamente e a feature responde de forma fechada.

**Operação:** uso de memória e rejeições de escrita devem ser monitorados; o
limite precisa comportar sessões, caches e projeções.

## D14 — metadata restrita

**Decisão:** metadata aceita apenas chaves conhecidas, strings limitadas e
contexto de segurança; senhas, hashes, tokens, cookies, JTI e mutation token não
entram nos eventos de notificação.

**Motivo:** eventos e auditoria possuem retenção maior e não podem se tornar um
canal secundário de vazamento.

## D15 — hash tags nas chaves

**Decisão:** chaves do mesmo usuário usam `{userId}`.

**Motivo:** scripts multi-key continuam compatíveis com Redis Cluster sem mudar
o contrato de storage no futuro.
