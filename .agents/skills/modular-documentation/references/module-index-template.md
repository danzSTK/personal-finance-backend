# Module Index Template

Use este modelo para estruturar o `README.md` raiz de cada módulo de domínio em `docs/<modulo>/README.md`.

```markdown
---
area: <modulo>
type: index
status: current
last_reviewed: <YYYY-MM-DD>
---

# <Nome do Módulo>

Descrição executiva de 2 a 3 parágrafos sobre a responsabilidade do módulo, o problema que ele resolve no produto Danfy e as fronteiras arquiteturais que ele preserva.

## Mapa da Documentação

### Conceitos
- [<Conceito 1>](./concepts/<conceito-1>.md) — Descrição curta em 1 linha.
- [<Conceito 2>](./concepts/<conceito-2>.md) — Descrição curta em 1 linha.

### Fluxos
- [<Fluxo 1>](./flows/<fluxo-1>.md) — Descrição do processo operacional.
- [<Fluxo 2>](./flows/<fluxo-2>.md) — Descrição do processo operacional.

### Decisões
- [<Decisão 1>](./decisions/<decisao-1>.md) — O porquê da decisão arquitetural.
- [<Decisão 2>](./decisions/<decisao-2>.md) — O porquê da decisão arquitetural.

### Referência
- [Invariants](./reference/invariants.md) — Regras de validação e integridade.
- [Schema](./reference/schema.md) — Estrutura de dados persistida.
- [Open Questions](./reference/open-questions.md) — Questões pendentes de definição.

## Estado Atual de Implementação

### Implementado
- [x] Item 1 já funcional no código.
- [x] Item 2 com testes passando.

### Pendente
- [ ] Melhoria ou extensão planejada.
- [ ] Reconciliação ou trabalho em background.
```
