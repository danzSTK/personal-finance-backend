---
area: auth
feature: email-verification
type: reference
status: proposed
related:
  - ./index.md
  - ./lua-scripts.md
  - ../../specs/auth/email-verification/specs/design.md
---

# Chaves Redis Do Reenvio De Verificação

## Escopo E Hash Tag

As chaves são operacionais e pertencem ao usuário autenticado. Todas usam a
hash tag `{userId}` para ocupar o mesmo slot em Redis Cluster e permitir scripts
Lua multi-key atômicos.

```text
auth:email-verification:{<userId>}:manual-resends
auth:email-verification:{<userId>}:cooldown
auth:email-verification:{<userId>}:last-send
auth:email-verification:{<userId>}:pending
```

Nenhuma chave contém e-mail, token, URL, template params ou outro dado sensível.

## Catálogo

| Sufixo           | Tipo   | Valor                                           | TTL                                 | Responsabilidade                                                        |
| ---------------- | ------ | ----------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `manual-resends` | ZSET   | membro=`challengeId`, score=`logicalSendAtMs`   | até o membro mais novo sair de 24 h | Contar somente resends manuais confirmados na janela móvel.             |
| `cooldown`       | STRING | `cooldownUntilMs`                               | exatamente até o fim do cooldown    | Responder rapidamente se existe cooldown e qual o PTTL.                 |
| `last-send`      | STRING | JSON `{ challengeId, origin, logicalSendAtMs }` | até 24 h após o envio               | Expor o último envio lógico no status sem consultar PostgreSQL.         |
| `pending`        | STRING | `mutationToken` opaco                           | 30 s                                | Serializar a criação manual de challenge/intenção e identificar o dono. |

## manual-resends

- Recebe apenas `MANUAL_RESEND`; `AUTOMATIC` nunca é inserido.
- O member é o `challengeId`, tornando a finalização idempotente com `ZADD NX`.
- Toda leitura remove scores `<= nowMs - 86_400_000` antes de contar.
- Ao atingir cinco membros, o retry diário termina em
  `oldestScore + 86_400_000`.
- O TTL físico é ajustado até o membro mais novo sair da janela. O pruning é a
  regra lógica; o TTL cuida da remoção quando não houver novas consultas.

## cooldown

- O envio automático calcula `logicalSendAt + 60s`.
- O envio manual calcula
  `logicalSendAt + min(60 * 2 ^ manualResendsUsedAfterSend, 600)s`.
- O valor guarda o instante absoluto; o TTL é derivado desse instante.
- Reprocessar uma finalização usa o `logicalSendAt` original e não reinicia o
  relógio.
- Uma atualização automática atrasada nunca encurta um cooldown manual maior já
  existente.

## last-send

Exemplo sanitizado:

```json
{
  "challengeId": "5c106f5b-9c64-4717-a4a8-a8aee4d838c0",
  "origin": "MANUAL_RESEND",
  "logicalSendAtMs": 1787662800000
}
```

O script somente substitui o valor quando o novo instante é igual ou posterior
ao armazenado, evitando regressão por handlers atrasados.

## pending

- Criada com `SET key mutationToken NX PX 30000`.
- Somente o token dono pode removê-la no complete ou abort.
- Concorrentes recebem o PTTL arredondado para cima como `Retry-After`.
- O TTL libera a operação se o processo morrer.

## Ausência E Indisponibilidade

Ausência de uma ou de todas as chaves não é erro. O estado resultante é:

```text
manualResendsUsed = 0
cooldown = inactive
lastLogicalSendAt = null
pending = inactive
```

Timeout, desconexão ou retorno Lua inválido não equivalem a chave ausente. Esses
casos produzem `EMAIL_VERIFICATION_STATE_UNAVAILABLE`; resend não abre transação
PostgreSQL e status retorna `503`.

## Constantes

Janela, limite, cooldowns e TTL da barreira vêm de constantes TypeScript
centrais e são enviados aos scripts por `ARGV`. Não existem números de produto
duplicados no texto Lua nem variáveis de ambiente para cooldown/limite.
