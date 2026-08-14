---
area: auth
type: reference
status: current
related:
  - ./flow/README.md
  - ./decisions/README.md
  - ./lua-scripts.md
  - ../reference/redis-keys.md
---

# Chaves Redis da alteração de senha

## Projeção por usuário

As seis chaves operacionais compartilham a hash tag `{userId}`. Em Redis
Cluster, isso mantém todas no mesmo slot e permite que os scripts Lua multi-key
continuem atômicos.

| Sufixo             | Tipo   | Valor                                  | TTL                                           | Finalidade                                                |
| ------------------ | ------ | -------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `failures`         | ZSET   | membro=`eventId`, score=`occurredAtMs` | até a última falha sair da janela de 15 min   | Contar falhas de confirmação da senha atual               |
| `block`            | STRING | `blockedUntilMs`                       | exatamente até `blockedUntil`                 | Impedir a operação antes de executar bcrypt               |
| `block-recurrence` | STRING | `lastBlockStartedAtMs`                 | até 24 h após o início do bloqueio            | Decidir se o próximo bloqueio dura 1 h ou 24 h            |
| `changes`          | ZSET   | membro=`eventId`, score=`occurredAtMs` | até a última alteração sair da janela de 24 h | Calcular cooldown e limite de três alterações             |
| `initialized`      | STRING | `1`                                    | 25 h                                          | Declarar que a projeção foi montada integralmente         |
| `pending`          | STRING | `mutationToken`                        | 2 min                                         | Serializar uma mutação por usuário e identificar seu dono |

Formato completo:

```text
auth:password-change:{<userId>}:failures
auth:password-change:{<userId>}:block
auth:password-change:{<userId>}:block-recurrence
auth:password-change:{<userId>}:changes
auth:password-change:{<userId>}:initialized
auth:password-change:{<userId>}:pending
```

### `failures`

O ZSET preserva identidade e instante de cada `CURRENT_PASSWORD_FAILED`. A
leitura remove scores fora da janela antes de executar `ZCARD`. Usar o UUID do
evento como membro torna a projeção idempotente: o mesmo fato não cria duas
falhas.

### `block`

O valor é o instante absoluto do fim do bloqueio, não sua duração. Isso permite
calcular `Retry-After` com o relógio atual. O TTL cuida apenas da remoção física;
a comparação de instantes continua sendo a regra.

### `block-recurrence`

Essa chave não significa que existe um bloqueio ativo. Ela guarda o início do
último bloqueio ainda relevante para reincidência. Por isso pode existir depois
de `block` expirar.

### `changes`

O ZSET contém fatos `PASSWORD_CHANGED` na janela móvel de 24 horas. Para decidir
cooldown e limite, a leitura precisa somente dos três scores mais recentes.

### `initialized`

É um marcador de completude, não uma autorização. Se estiver ausente, o loader
retorna `MISSING`, consulta `password_change_events` e executa um `replace`
integral. Isso evita interpretar perda parcial de chaves como estado vazio.

O TTL de 25 horas é maior que a maior janela normal de decisão. Sua expiração
programada também força uma reconstrução periódica a partir da fonte durável.

### `pending`

É adquirida com `SET NX PX`. O nome é estável por usuário; o valor muda a cada
operação e funciona como token de propriedade. Somente um `replace` que
apresente o mesmo token pode remover a barreira. O TTL de dois minutos recupera
o fluxo caso o processo seja encerrado.

Ao adquirir `pending`, o script remove `initialized`. Enquanto a mutação está em
andamento, nenhuma leitura pode usar uma projeção anterior como se fosse atual.

## Limites técnicos de custo

| Chave                                             | Tipo            | Valor                     | TTL  | Finalidade                     |
| ------------------------------------------------- | --------------- | ------------------------- | ---- | ------------------------------ |
| `auth:password-change:cost:ip:<fingerprint>`      | STRING contador | quantidade de requisições | 60 s | Limitar custo agregado por IP  |
| `auth:password-change:cost:session:<fingerprint>` | STRING contador | quantidade de requisições | 60 s | Limitar custo por access token |

Os fingerprints são `HMAC-SHA256` codificados em base64url. HMAC não é
criptografia reversível: ele oculta os valores originais no keyspace e, no caso
do IP, impede comparação por dicionário sem o segredo configurado.

O identificador usado no limite chamado de “sessão” é atualmente o JTI do
access token. Portanto, o limite é por access token, não por uma sessão estável
compartilhada por access e refresh.

## JTI no Redis e no PostgreSQL

O HMAC existe somente para os nomes das chaves técnicas de custo. O campo
`password_change_events.session_id` armazena o JTI original do access token
como UUID para correlação de auditoria. O JTI isolado não permite assinar ou
reconstruir um JWT, mas a tabela deve ser tratada como dado de segurança com
acesso e retenção controlados.

## Reconstrução integral

O estado Redis não é atualizado com operações incrementais como “somar uma
falha” ou “alterar somente o bloqueio”. O sincronizador:

1. lê do PostgreSQL todos os fatos ainda relevantes;
2. o assembler recalcula falhas, alterações, bloqueio ativo e reincidência;
3. o script de `replace` apaga a projeção anterior;
4. recria todas as métricas e TTLs na mesma execução atômica;
5. grava `initialized` por último;
6. remove `pending` somente quando o token de propriedade confere.

Essa escolha usa mais leitura e escrita que uma atualização pontual, porém
impede deriva entre chaves, simplifica retry e torna perda total ou parcial do
Redis recuperável pelo mesmo caminho.

## Política operacional

O Redis usa persistência AOF e `maxmemory-policy noeviction`. Se não puder
garantir leitura ou escrita do estado, a alteração de senha falha de forma
fechada; o sistema não interpreta indisponibilidade como ausência de restrição.
