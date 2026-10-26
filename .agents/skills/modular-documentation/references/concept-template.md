# Concept Template

Use este modelo para documentar entidades de domínio, objetos de valor ou termos centrais da linguagem ubíqua em `docs/<modulo>/concepts/`.

```markdown
---
area: <modulo>
type: concept
status: current
related:
  - ./outro-conceito-do-modulo.md
  - ../flows/<fluxo-principal>.md
---

# <Nome do Conceito>

Definição clara e substantiva do conceito no contexto de negócio da Danfy.

Explique a finalidade do conceito respondendo:
- O que ele representa no mundo real financeiro ou operacional da Danfy?
- Por que ele existe como uma abstração separada e não incorporado em outra entidade?
- O que ele **não é** e **não deve fazer** (fronteiras negativas)?

## Identidade e Ownership

- **Identidade:** Como a entidade é unicamente identificada (ex.: UUID estável, natural key).
- **Ownership:** A quem pertence este conceito no modelo multi-tenant (ex.: `user_id`).
- **Ciclo de vida:** Como nasce, como transiciona e como deixa de existir.

## Estados Possíveis

Se o conceito possuir uma máquina de estados:

| Estado | Significado de Negócio | Pode transicionar para |
|:---|:---|:---|
| `ESTADO_1` | Significado no produto | `ESTADO_2`, `FALHA` |
| `ESTADO_2` | Significado no produto | `CONCLUIDO` |

## Relação com Outros Conceitos

Descreva como este conceito se conecta a outros agregados e módulos:

- Como o módulo consumidor faz referência a este conceito (ex.: apenas guardando a chave estrangeira lógica sem acoplamento ORM).
- Relação unidirecional vs bidirecional.
```
