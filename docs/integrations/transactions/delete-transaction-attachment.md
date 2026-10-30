---
area: transactions
type: integration
status: current
method: DELETE
path: /transactions/:id/attachments/:attachmentId
---

# Delete Transaction Attachment

Exclui individualmente um comprovante da galeria de uma transação.

```http
DELETE /transactions/:id/attachments/:attachmentId
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a requisição com credenciais (`credentials: 'include'` ou `withCredentials: true`).

## Path Parameters

| Parâmetro      | Tipo   | Obrigatório | Descrição                   |
| -------------- | ------ | ----------: | --------------------------- |
| `id`           | `uuid` |         sim | Identificador da transação. |
| `attachmentId` | `uuid` |         sim | Identificador do anexo.     |

## Resposta `204 No Content`

A requisição não retorna corpo. O vínculo do anexo é removido imediatamente, as posições dos anexos restantes são reordenadas automaticamente para manter a sequência `0..N-1`, e o arquivo físico é agendado para desalocação no Cloudflare R2 pelo reconciliador de assets.

## Invalidação de Cache no Frontend

Após a exclusão com sucesso:
1. Invalide a query da galeria da transação: `queryClient.invalidateQueries(['transaction-attachments', transactionId])`.
2. Invalide a query da listagem de transações para atualizar o `attachmentsCount`: `queryClient.invalidateQueries(['transactions'])`.

## Erros Esperados

| Status | Code                               | Quando                                                                              |
| -----: | ---------------------------------- | ----------------------------------------------------------------------------------- |
|  `401` | `UNAUTHORIZED`                     | Sessão ausente, inválida ou expirada.                                               |
|  `404` | `TRANSACTION_NOT_FOUND`            | Transação inexistente, soft-deletada ou pertencente a outro usuário.                |
|  `404` | `TRANSACTION_ATTACHMENT_NOT_FOUND` | Anexo inexistente ou não associado a esta transação.                               |
