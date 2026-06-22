---
area: events
type: event
status: current
eventName: user.avatar.updated
eventVersion: 1
aggregateType: User
related:
  - ./README.md
  - ./events-map.canvas
  - ../users/flows/update-user-avatar.md
  - ../assets/flows/delete-asset.md
---

# UserAvatarUpdatedEvent

`user.avatar.updated` representa a troca da referência de avatar de um usuário. O fato pertence a `users`; a remoção física do objeto anterior pertence a `assets` e ao Object Storage.

## Estado Atual

| Item                                | Status  |
| ----------------------------------- | ------- |
| Entidade registra o evento          | current |
| Contrato e hydrator                 | current |
| Registro no `EventRegistry`         | current |
| Use case grava o evento na outbox   | planned |
| Consumidor remove o avatar anterior | planned |

O contrato já pode ser usado pelo futuro use case, mas nenhuma mensagem será produzida até esse use case persistir o usuário e drenar seus eventos na mesma transação.

## Contrato

| Campo             | Tipo             | Descrição                                 |
| ----------------- | ---------------- | ----------------------------------------- |
| `userId`          | `string`         | Usuário cuja referência mudou             |
| `previousAssetId` | `string \| null` | Asset anterior; `null` no primeiro avatar |
| `currentAssetId`  | `string`         | Novo asset associado ao usuário           |

Metadados:

| Campo              | Valor                 |
| ------------------ | --------------------- |
| `eventName`        | `user.avatar.updated` |
| `eventVersion`     | `1`                   |
| `aggregateType`    | `User`                |
| `aggregateId`      | `userId`              |
| `deduplicationKey` | `null`                |

Esse evento não usa uma chave global de deduplicação. O mesmo asset pode voltar a ser escolhido no futuro, e uma chave baseada apenas no usuário e no asset suprimiria uma transição legítima. O consumidor deve ser idempotente a partir do estado persistido de `previousAssetId`.

## Produção Planejada

O use case de atualização deve executar em uma única transação PostgreSQL:

1. carregar o usuário com `findByIdForUpdate()`;
2. tornar o novo asset `READY`;
3. chamar `User.changeAvatarAsset(currentAssetId)`;
4. salvar o usuário;
5. persistir os eventos drenados do aggregate na outbox com o mesmo `EntityManager`.

O lock serializa duas atualizações concorrentes para o mesmo usuário. Sem ele, ambos os requests poderiam observar o mesmo avatar anterior e deixar um asset intermediário sem limpeza.

## Consumo Planejado

Quando `previousAssetId` não for `null`, o consumidor de `assets` deve:

- localizar o asset pelo ID e pelo `userId` do evento;
- ignorar com sucesso se ele já estiver `DELETE_PENDING` ou `DELETED`;
- marcar o asset como `DELETE_PENDING`;
- solicitar a exclusão idempotente no Object Storage;
- marcar o asset como `DELETED` depois da confirmação.

`currentAssetId` nunca deve ser removido por esse consumidor. Ownership precisa ser validado mesmo que o payload venha da outbox.
