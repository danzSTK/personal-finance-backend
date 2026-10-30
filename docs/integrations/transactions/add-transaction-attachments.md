---
area: transactions
type: integration
status: current
method: POST
path: /transactions/:id/attachments
---

# Add Transaction Attachments

Faz upload de 1 a 3 comprovantes/imagens para a galeria de uma transação.

```http
POST /transactions/:id/attachments
Content-Type: multipart/form-data
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a requisição com credenciais (`credentials: 'include'` ou `withCredentials: true`).

## Path Parameters

| Parâmetro | Tipo   | Obrigatório | Descrição                   |
| --------- | ------ | ----------: | --------------------------- |
| `id`      | `uuid` |         sim | Identificador da transação. |

## Multipart Form Data

| Campo   | Tipo              | Obrigatório | Regra                                                                |
| ------- | ----------------- | ----------: | -------------------------------------------------------------------- |
| `files` | arquivo binário[] |         sim | De 1 a 3 arquivos; PNG, JPEG (`.jpg`/`.jpeg`) ou WebP; até 5 MB cada |

Exemplo via `FormData`:
```typescript
const formData = new FormData();
selectedFiles.forEach(file => {
  formData.append('files', file);
});

await api.post(`/transactions/${transactionId}/attachments`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
```

## Validações de Arquivo

O backend não confia no MIME informado pelo navegador:
- O formato é detectado inspecionando os **magic bytes** reais do binário (`image/png`, `image/jpeg` ou `image/webp`).
- PDFs e documentos de texto **não** são aceitos na V1.
- O arquivo pode ter no máximo **5 MB** (`5 * 1024 * 1024` bytes).
- A imagem pode ter resolução máxima de **60 Megapixels** (`width * height <= 60_000_000`).

## Resposta `201 Created`

Retorna um array com os anexos recém-criados e suas Presigned URLs prontas para renderização:

```json
[
  {
    "id": "b9344403-c4bd-4e64-8a9b-10f2c44b4434",
    "assetId": "25f9382f-d990-4759-b24e-761336431fc0",
    "position": 0,
    "contentType": "image/png",
    "sizeBytes": 102400,
    "url": "https://danfy-private-bucket.66e3e3b8cb0c58aa04976d58906ddb5d.r2.cloudflarestorage.com/users/...?X-Amz-Signature=...",
    "expiresAt": "2026-10-30T14:40:09.128Z",
    "cacheMaxAgeSeconds": 240
  }
]
```

## Processamento Assíncrono em Segundo Plano

O response `201 Created` significa que o anexo já está **`READY` e disponível** para visualização com o arquivo original no R2 Privado.

Em segundo plano, o Worker da Danfy processa a imagem via BullMQ e Sharp de forma transparente:
- Remove metadados EXIF e dados de GPS por privacidade.
- Reduz proporcionalmente para caber em uma caixa de até 2560 × 2560 pixels (sem distorcer nem ampliar).
- Otimiza para WebP com quality 80.
- O frontend não precisa aguardar nem monitorar esse processamento: a Presigned URL permanece válida e o arquivo é atualizado de forma transparente.

## Invalidação de Cache no Frontend

Após sucesso do upload:
1. Invalide a query da galeria da transação: `queryClient.invalidateQueries(['transaction-attachments', transactionId])`.
2. Invalide a listagem de transações para atualizar o contador `attachmentsCount`: `queryClient.invalidateQueries(['transactions'])`.

## Erros Esperados

| Status | Code                                              | Quando                                                                                      |
| -----: | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
|  `400` | `BAD_REQUEST`                                     | Nenhum arquivo foi enviado no campo `files` ou o campo excede 3 itens na mesma requisição.  |
|  `401` | `UNAUTHORIZED`                                    | Sessão ausente, inválida ou expirada.                                                       |
|  `404` | `TRANSACTION_NOT_FOUND`                           | Transação inexistente, soft-deletada ou pertencente a outro usuário.                        |
|  `409` | `TRANSACTION_TYPE_DOES_NOT_SUPPORT_ATTACHMENTS`   | Tentativa de anexar em transação do tipo `TRANSFER` ou `ADJUSTMENT`.                        |
|  `409` | `TRANSACTION_ATTACHMENT_LIMIT_EXCEEDED`           | O número de anexos ativos existentes somado aos enviados ultrapassa o teto de 3 da galeria. |
|  `413` | `ATTACHMENT_FILE_TOO_LARGE`                       | Pelo menos um arquivo enviado excede o limite de 5 MB.                                      |
|  `415` | `UNSUPPORTED_ATTACHMENT_FILE`                     | O formato real do arquivo não é PNG, JPEG ou WebP (ex.: PDF, TXT, HEIC).                    |
|  `422` | `ATTACHMENT_DIMENSIONS_EXCEEDED`                  | Pelo menos uma imagem excede o teto técnico de 60 Megapixels.                               |
