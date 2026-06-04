---
area: categories
type: integration
status: current
endpoint: GET /categories/metadata
---

# Get Category Metadata

Retorna o catálogo oficial de tokens visuais aceitos pelo backend para categorias.

```http
GET /categories/metadata
```

Use essa rota para montar seletores de cor e ícone no frontend.

## Resposta

```json
{
  "icons": [
    { "key": "wallet", "label": "Carteira" },
    { "key": "landmark", "label": "Banco" },
    { "key": "utensils", "label": "Alimentação" }
  ],
  "colors": [
    { "key": "blue", "label": "Azul", "hex": "#3B82F6" },
    { "key": "orange", "label": "Laranja", "hex": "#F97316" },
    { "key": "emerald", "label": "Esmeralda", "hex": "#10B981" }
  ]
}
```

## Regras Para O Frontend

- `key` é o valor que deve ser enviado em `iconKey` ou `colorToken`;
- `label` é texto de apoio para UI;
- `hex` serve para preview de cor e fallback visual;
- o frontend ainda precisa mapear `iconKey` para o componente visual que ele usa;
- se o frontend receber token desconhecido em alguma resposta antiga/cacheada, use fallback visual local;
- não envie valores fora desse catálogo em `POST /categories` ou `PATCH /categories/:id`.

## Respostas

| Status | Quando                     |
| -----: | -------------------------- |
|  `200` | Catálogo carregado         |
|  `401` | Sessão ausente ou inválida |
