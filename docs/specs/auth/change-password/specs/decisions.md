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

## D9 — eventos desacoplados do envio

**Decisão:** persistir e publicar `auth.password-change.changed` e
`auth.password-change.block-started`; handlers de notifications transformam
esses fatos em intenções persistidas e jobs somente depois do commit da senha.

**Motivo:** mantém a transação de segurança independente do provider de e-mail
e permite retry sem reexecutar a alteração ou o bloqueio.

**Processamento local:** não haverá backfill ou replay retroativo dos eventos que
tenham chegado a `DEAD` antes da existência dos handlers, pois a feature ainda
não possui dados de produção.

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

## D16 — catálogo lógico e versionado para os e-mails de segurança

**Decisão:** usar `password-changed:v1` e `password-change-blocked:v1` no domínio
de notifications. Somente `mail.config.ts` traduz essas referências para IDs da
Brevo.

**Motivo:** handlers, casos de uso, persistência e jobs não devem conhecer o
provider externo. A versão preserva o contrato e o conteúdo usados pela intenção
original durante retries futuros.

**Consequência:** contrato TypeScript, schema Zod, HTML, mapping e documentação
precisam evoluir juntos; uma versão publicada não pode ser alterada.

## D17 — uma intenção idempotente por fato fonte

**Decisão:** derivar a `idempotency_key` do `sourceEventId` do fato de senha e
resolver concorrência pela constraint única de `email_messages`.

**Motivo:** a outbox possui entrega pelo menos uma vez. Persistir a intenção antes
do enqueue, reler o vencedor de uma violação única e usar job determinístico
impede e-mails duplicados sem depender da memória do processo.

**Consequência:** eventos repetidos podem reenfileirar somente mensagens
elegíveis; mensagens em estado terminal são ignoradas.

## D18 — conteúdo dos templates definido antes do HTML

**Decisão:** registrar contratos e fluxo antes dos HTMLs, mas construir os dois
templates somente após definir título, tom, ação principal e instruções de
segurança com o responsável pelo produto.

**Motivo:** o design visual já é rígido, porém o conteúdo é parte do contrato da
versão publicada e não deve ser inventado durante a implementação técnica.

**Consequência:** os HTMLs v1 seguem o conteúdo de segurança aprovado para
preview, usam exatamente os parâmetros declarados e passam pelo validador de
fontes. Depois de ativados para envio, mudanças perceptíveis exigem uma nova
versão.

## D19 — timezone e remetente pertencem ao contrato de apresentação

**Decisão:** formatar datas dos e-mails em `America/Sao_Paulo` como
`DD/MM/AAAA às HH:mm` e deixar que cada template hospedado defina o remetente.
Os templates de alteração de senha usam `security@danfy.app`; o worker envia
`templateId` sem `sender`, salvo quando um consumidor solicitar uma
sobrescrita explícita.

**Motivo:** o destinatário deve receber um horário brasileiro inequívoco, sem
depender do timezone do container. O remetente é uma propriedade operacional do
template e não deve virar uma constante do domínio nem ser sobrescrito pelo
remetente genérico da plataforma.

**Consequência:** o formato persistido em `email_messages.template_params` é de
apresentação, enquanto os eventos continuam carregando instantes. Templates
hospedados precisam ter sender válido; envios HTML/texto sem template continuam
usando `MAIL_DEFAULT_FROM_EMAIL`.
