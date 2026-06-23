---
area: users
type: integration
status: current
endpoint: PUT /users/me/avatar
---

# Update User Avatar

Substitui o avatar do usuário autenticado.

```http
PUT /users/me/avatar
Content-Type: multipart/form-data
```

## Autenticação

Use o cookie HttpOnly `accessToken` e envie a request com credenciais. Não envie `userId`, bucket, key ou purpose.

## Multipart

| Campo  | Tipo            | Obrigatório | Regra                       |
| ------ | --------------- | ----------: | --------------------------- |
| `file` | arquivo binário |         sim | Até 5 MB; JPEG, PNG ou WebP |

O backend não confia no MIME informado pelo navegador. O formato é detectado pela assinatura dos bytes, decodificado pelo Sharp e normalizado para WebP `512x512`.

## Resposta `200`

```json
{
  "assetId": "fe52a36f-5fc7-43ce-8827-52a6aa17d478",
  "url": "https://assets.example.com/users/85423f76-b2e0-4499-8b94-da58b1df6f74/avatars/fe52a36f-5fc7-43ce-8827-52a6aa17d478.webp"
}
```

O `url` já está pronto para exibição. O frontend não deve montar URL nem interpretar a storage key.

## Erros

| Status | Code                                           | Quando                                      |
| -----: | ---------------------------------------------- | ------------------------------------------- |
|  `400` | `BAD_REQUEST`                                  | Campo `file` não foi enviado                |
|  `401` | `UNAUTHORIZED`                                 | Sessão ausente ou inválida                  |
|  `413` | `AVATAR_FILE_TOO_LARGE` ou `PAYLOAD_TOO_LARGE` | Arquivo excede 5 MB                         |
|  `415` | `UNSUPPORTED_AVATAR_FILE`                      | Formato real não é JPEG, PNG ou WebP        |
|  `422` | `INVALID_AVATAR_IMAGE`                         | Imagem não pode ser decodificada/processada |
|  `503` | `AVATAR_UPLOAD_FAILED`                         | R2 não concluiu o upload                    |

## Substituição Assíncrona

O response `200` significa que o novo avatar está `READY` e já foi associado ao usuário. A remoção do avatar anterior ocorre depois pelo evento `user.avatar.updated`.

Falhas na limpeza não desfazem o novo avatar. O asset anterior fica `DELETE_PENDING` e a outbox tenta novamente.

Para remover sem substituir, use [DELETE /users/me/avatar](./remove-user-avatar.md).
