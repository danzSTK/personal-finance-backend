---
area: assets
type: concept
status: current
related:
  - ./asset.md
  - ../reference/schema.md
---

# Asset Metadata

Metadata guarda propriedades técnicas confirmadas sobre o objeto final.

Para imagens:

```json
{
  "width": 512,
  "height": 512,
  "format": "webp"
}
```

Isso evita baixar ou decodificar novamente um objeto apenas para descobrir dimensões ou formato.

Metadata não deve armazenar:

- regra de negócio;
- dados arbitrários enviados pelo cliente;
- resposta completa do SDK;
- stack trace ou mensagem bruta de erro;
- URL pública.

Campos consultados frequentemente ou necessários a constraints devem virar colunas explícitas em vez de crescer indefinidamente dentro do JSONB.
