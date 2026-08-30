---
area: accounts
type: integration
status: current
endpoint: POST /accounts
---

# Create Account

Cria uma account para o usuário autenticado. Use este endpoint para contas criadas manualmente pelo usuário.

```http
POST /accounts
```

## Body

```json
{
  "name": "Nubank",
  "type": "BANK",
  "initialBalanceCents": 100000,
  "template": {
    "type": "institutional",
    "templateId": "54066cca-075e-4300-923b-f5b36462aa1f"
  },
  "includeInTotal": true,
  "isDefault": false
}
```

## Campos

| Campo | Tipo | Obrigatório | Observação |
|---|---|---:|---|
| `name` | `string` | sim | Nome exibido ao usuário; mínimo 3 e máximo 255 caracteres |
| `type` | `BANK \| CREDIT_CARD \| INVESTMENT` | sim | Tipo da account criada pelo usuário |
| `initialBalanceCents` | `number` | não | Saldo inicial em centavos; default `0` quando omitido; não aceita valor negativo |
| `template` | objeto discriminado | não durante `DB-COMPAT-002` | Identidade institucional ou customizada descrita abaixo; não aceita `null` |
| `color` | `ColorToken \| null` | não | Deprecated; contrato legado v0.3 |
| `icon` | `IconKey \| null` | não | Deprecated; contrato legado v0.3 |
| `includeInTotal` | `boolean` | não | Default `true`; define se entra em totais agregados |
| `isDefault` | `boolean` | não | Quando `true`, torna esta account a default |

### Template institucional

```json
{
  "type": "institutional",
  "templateId": "54066cca-075e-4300-923b-f5b36462aa1f"
}
```

O backend confirma que o ID pertence a um template institucional ativo. O `type` do request não altera a classificação persistida.

### Template customizado

```json
{
  "type": "custom",
  "colorToken": "blue",
  "iconKey": "wallet"
}
```

`colorToken` e `iconKey` são opcionais e aceitam `null`. O backend cria o template como `CUSTOM`, atribui o usuário autenticado como owner e não aceita `templateId`, owner nem metadados institucionais neste branch.

## Resposta

```json
{
  "object": "account.item",
  "id": "5f6b18c6-1fd9-4e8f-99a8-4a7b65ef56e2",
  "name": "Nubank",
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
  "color": "nubank",
  "icon": "landmark",
  "includeInTotal": true,
  "isArchived": false,
  "isDefault": false,
  "createdAt": "2026-05-02T20:00:00.000Z",
  "updatedAt": "2026-05-02T20:00:00.000Z"
}
```

## Regras Para O Frontend

- Não envie `userId`; o backend usa a sessão autenticada.
- Não use `POST /accounts` para criar `CASH`; a `CASH` default é criada pelo backend no onboarding.
- Prefira `template`. Não combine `template` com `color` ou `icon` no mesmo request.
- Durante a compatibilidade, requests v0.3 sem `template` continuam aceitos e materializam um template customizado privado.
- Se `isDefault=true`, a nova account vira default e a default anterior deixa de ser default.
- Se o usuário ainda não tiver default ativa, a nova account pode virar default automaticamente.

## Respostas

| Status | Quando |
|---:|---|
| `201` | Account criada |
| `400` | Body inválido |
| `401` | Sessão ausente ou inválida |
| `409` | Conflito de regra de negócio |
