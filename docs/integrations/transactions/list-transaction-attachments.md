---
area: transactions
type: integration
status: current
method: GET
path: /transactions/:id/attachments
---

# List Transaction Attachments (Galeria)

Retorna a galeria completa de comprovantes e anexos ativos associados a uma transaction do usuário autenticado.

```http
GET /transactions/:id/attachments
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a requisição com credenciais (`credentials: 'include'` ou `withCredentials: true`).

## Path Parameters

| Parâmetro | Tipo   | Obrigatório | Descrição                   |
| --------- | ------ | ----------: | --------------------------- |
| `id`      | `uuid` |         sim | Identificador da transação. |

## Resposta `200 OK`

Retorna um array com até 3 anexos ativos ordenados por `position ASC`:

```json
[
  {
    "id": "b9344403-c4bd-4e64-8a9b-10f2c44b4434",
    "assetId": "25f9382f-d990-4759-b24e-761336431fc0",
    "position": 0,
    "contentType": "image/webp",
    "sizeBytes": 84210,
    "url": "https://danfy-private-bucket.66e3e3b8cb0c58aa04976d58906ddb5d.r2.cloudflarestorage.com/users/0fb4ab29-227c-4346-943b-5e778fa3d418/transaction-attachments/25f9382f-d990-4759-b24e-761336431fc0?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=300...",
    "expiresAt": "2026-10-30T14:40:09.128Z",
    "cacheMaxAgeSeconds": 240
  }
]
```

### Campos do Item

| Campo                | Tipo     | Descrição                                                                                             |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `id`                 | `uuid`   | Identificador único do anexo na galeria da transação.                                                 |
| `assetId`            | `uuid`   | Identificador do asset subjacente que gerencia o arquivo físico.                                      |
| `position`           | `number` | Posição visual na galeria (inteiro de `0` a `2`).                                                     |
| `contentType`        | `string` | MIME type real do arquivo (ex.: `image/webp`, `image/png`, `image/jpeg`).                             |
| `sizeBytes`          | `number` | Tamanho do arquivo em bytes.                                                                          |
| `url`                | `string` | **Presigned URL de leitura** do Cloudflare R2 Privado. Válida para acesso direto em tags `<img />`.   |
| `expiresAt`          | `string` | Data/hora ISO de expiração estrita da URL no provedor de storage (300 segundos após a emissão).       |
| `cacheMaxAgeSeconds` | `number` | Tempo recomendado em segundos (`240` = 4 min) para retenção da URL em cache pelo cliente (TanStack). |

## Política de Cache no Frontend (TanStack Query)

O frontend **deve** configurar a query do TanStack com o `staleTime` derivado do `cacheMaxAgeSeconds`:

```typescript
const { data: attachments } = useQuery({
  queryKey: ['transaction-attachments', transactionId],
  queryFn: () => api.get(`/transactions/${transactionId}/attachments`),
  staleTime: 240 * 1000, // 4 minutos (respeita cacheMaxAgeSeconds)
  enabled: attachmentsCount > 0, // Se attachmentsCount for 0, não precisa bater na API!
});
```

A margem de segurança de 60 segundos entre o `cacheMaxAgeSeconds` (240s) e o `expiresIn` real do R2 (300s) garante que a imagem nunca falhe por expiração enquanto o usuário estiver navegando.

## Erros Esperados

| Status | Code                    | Quando                                                                              |
| -----: | ----------------------- | ----------------------------------------------------------------------------------- |
|  `401` | `UNAUTHORIZED`          | Sessão ausente, inválida ou expirada.                                               |
|  `404` | `TRANSACTION_NOT_FOUND` | Transação inexistente, soft-deletada ou pertencente a outro usuário (IDOR protegido). |
