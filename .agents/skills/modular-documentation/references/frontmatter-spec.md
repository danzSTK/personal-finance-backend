# Frontmatter Specification

Especificação dos campos de metadados obrigatórios no cabeçalho YAML dos documentos em `docs/<modulo>/`.

```yaml
---
area: <modulo>
type: <tipo>
status: <status>
related:
  - <caminho-relativo-1>
  - <caminho-relativo-2>
---
```

## Campos

### `area` (Obrigatório)
Identificador do domínio correspondente em letras minúsculas:
- `accounts`
- `assets`
- `auth`
- `categories`
- `health`
- `notifications`
- `transactions`
- `users`
- `architecture`
- `platform`

### `type` (Obrigatório)
Classificação estrutural do documento:
- `concept`: modelo conceitual, entidade, value object ou fronteira de agregado.
- `flow`: fluxo de processo, ciclo de vida, sequência operacional ou passos em background.
- `decision`: registro de decisão arquitetural (ADR) explicando escolhas e trade-offs.
- `reference`: especificações de contratos, dicionários de erros, tabelas de constantes e esquemas.
- `index`: índice central de módulo (`README.md`).

### `status` (Obrigatório)
Estado de vigência da documentação:
- `draft`: especificação em discussão ou definição técnica que ainda não reflete código em produção.
- `current`: documentação ativa, canônica e alinhada ao estado atual da aplicação.
- `deprecated`: decisão ou fluxo descontinuado, preservado apenas para histórico ou rastreabilidade.

### `related` (Opcional, altamente recomendado)
Lista de links relativos para outros documentos que formam o grafo de contexto do documento atual.
