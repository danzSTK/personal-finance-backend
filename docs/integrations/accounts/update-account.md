---
area: accounts
type: integration
status: current
endpoint: PATCH /accounts/:id
---

# Update Account

Atualiza campos editáveis de uma account do usuário autenticado.

```http
PATCH /accounts/:id
```

## Body

Envie pelo menos um campo editável.

```json
{
  "name": "Conta principal",
  "template": {
    "type": "institutional",
    "templateId": "54066cca-075e-4300-923b-f5b36462aa1f"
  },
  "includeInTotal": true
}
```

## Campos

| Campo            | Tipo                                        | Observação                                                                   |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `name`           | `string`                                    | Nome exibido ao usuário; mínimo 3 e máximo 255 caracteres; não aceita `null` |
| `type`           | `CASH \| BANK \| CREDIT_CARD \| INVESTMENT` | Tipo da account; não aceita `null`                                           |
| `template`       | objeto discriminado                         | Seleciona institucional ou define customizado; não aceita `null`             |
| `color`          | `ColorToken \| null`                        | Deprecated; atualiza/materializa custom para compatibilidade v0.3            |
| `icon`           | `IconKey \| null`                           | Deprecated; atualiza/materializa custom para compatibilidade v0.3            |
| `includeInTotal` | `boolean`                                   | Define se entra em totais agregados; não aceita `null`                       |

`initialBalanceCents` não é editado por este endpoint.

## Regras

- Accounts arquivadas não aceitam update comum.
- Body vazio é conflito de regra.
- `userId` vem da sessão, nunca do body.
- Não combine `template` com `color` ou `icon` no mesmo request.
- `template.type=institutional` exige `templateId`; o backend confirma que a referência persistida é institucional e ativa.
- `template.type=custom` aceita `colorToken`/`iconKey` opcionais. Se o template atual já for customizado, campos omitidos são preservados; ao sair de um institucional, campos omitidos começam como `null`.
- O backend decide e protege o `template_type` persistido; o discriminador do request não permite promover template customizado a institucional.
- Para `CASH`, o frontend deve expor edição de `name`, template visual e `includeInTotal`.

## Resposta

```json
{
  "object": "account.item",
  "id": "5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
  "name": "Conta principal",
  "type": "BANK",
  "initialBalanceCents": 100000,
  "templateId": "54066cca-075e-4300-923b-f5b36462aa1f",
  "template": {
    "object": "account_template.item",
    "id": "54066cca-075e-4300-923b-f5b36462aa1f",
    "type": "INSTITUTIONAL",
    "name": "Nubank",
    "colorToken": "nubank",
    "iconKey": null,
    "logoUrl": "https://public.example/banking-institutions-icons/nubank.svg",
    "bankCode": 260,
    "ispb": "18236120"
  },
  "color": "purple",
  "icon": "landmark",
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": true,
  "createdAt": "2026-05-02T20:00:00.000Z",
  "updatedAt": "2026-05-02T20:10:00.000Z"
}
```

## Respostas

| Status | Quando                                          |
| -----: | ----------------------------------------------- |
|  `200` | Account atualizada                              |
|  `400` | Body inválido                                   |
|  `401` | Sessão ausente ou inválida                      |
|  `404` | Account ou template selecionável não encontrado |
|  `409` | Account arquivada ou patch vazio                |
