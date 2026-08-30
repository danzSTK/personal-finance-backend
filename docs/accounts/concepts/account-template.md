---
area: accounts
type: concept
status: current
related:
  - ../decisions/account-visual-identity-uses-templates.md
  - ../decisions/institutional-account-template-catalog-is-curated.md
  - ../reference/account-template-catalog-operations.md
---

# Account Template

`AccountTemplate` representa a identidade visual de uma account sem misturar apresentação com seus dados financeiros.

- `INSTITUTIONAL`: global, sem owner, imutável pelo usuário, com token da instituição e SVG servido pelo Object Storage da Danfy.
- `CUSTOM`: privado, pertencente ao usuário, com `colorToken`/`iconKey` opcionais e sem logo institucional.

Templates institucionais inativos não aparecem em novas escolhas, mas continuam sendo retornados para accounts já associadas. O response expõe uma URL pública derivada; bucket e storage key permanecem internos.

BrasilAPI e o CDN de origem participam somente da curadoria explícita. Requests, startup, worker e seed não os consultam.
