---
area: assets
type: concept
status: current
related:
  - ./asset.md
  - ./storage-key.md
---

# Asset Purpose

`purpose` é uma chave estável que explica para qual função do produto um asset foi criado.

## Catálogo Atual

| Purpose | Significado |
| --- | --- |
| `USER_AVATAR` | Imagem pública de perfil pertencente a um usuário. |

Purpose não é MIME type, nome de pasta nem descrição livre enviada pelo frontend. Um novo valor deve representar uma nova finalidade real e entrar explicitamente no catálogo do domínio.

O purpose pode orientar uma policy de geração da key, validações permitidas e rotinas de limpeza. Ele não deve fazer a entidade `Asset` conhecer todos os formatos de caminho futuros.
