---
area: accounts
type: integration
status: current
endpoint: GET /account-templates
---

# List Account Templates

Lista somente templates institucionais ativos disponíveis para nova associação.

```http
GET /account-templates
```

```json
[
  {
    "object": "account_template.item",
    "id": "54066cca-075e-4300-923b-f5b36462aa1f",
    "type": "INSTITUTIONAL",
    "name": "Nubank",
    "colorToken": "nubank",
    "iconKey": null,
    "logoUrl": "https://public.example/banking-institutions-icons/nubank.svg",
    "bankCode": 260,
    "ispb": "18236120"
  }
]
```

O frontend interpreta `colorToken` e renderiza `logoUrl`. Não derive URL, bucket ou storage key e não consulte BrasilAPI/CDN. Template inativo deixa de aparecer aqui, mas pode continuar presente no response de uma account já vinculada.

| Status | Quando |
| ---: | --- |
| `200` | Catálogo retornado, inclusive lista vazia |
| `401` | Sessão ausente ou inválida |
