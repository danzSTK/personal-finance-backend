---
area: categories
type: architecture
status: current
related:
  - ./decisions/categories.md
  - ./reference/visual-tokens.md
  - ../events/user-created.md
  - ../integrations/categories/README.md
---

# Categories

Categorias classificam o motivo financeiro de uma transaction.

Elas respondem perguntas como:

- esse dinheiro entrou por que?
- esse dinheiro saiu por que?
- isso deve contar como despesa, receita, transferência, ajuste ou investimento?
- essa categoria deve participar dos relatórios agregados?

A documentação principal de regra de negócio está em [Categories decisions](./decisions/categories.md).

Tokens oficiais de cor e ícone ficam em [Category visual tokens](./reference/visual-tokens.md).

Para contrato HTTP consumido pelo frontend, veja [Categories integration](../integrations/categories/README.md).

## Estado Atual

O backend já possui CRUD de categorias gerenciáveis:

- criar;
- listar com paginação, tipo e busca;
- buscar por id;
- atualizar;
- arquivar;
- desarquivar;
- deletar sem transações;
- deletar com merge de transações para outra categoria.
- obter metadata de tokens visuais para criação/edição.

Ainda está planejado:

- seed/onboarding das categorias default por `user.created`;
- criação das categorias técnicas `TRANSFER` e `ADJUSTMENT` no onboarding;
- definição final dos nomes das categorias default.

## Modelo Mental

Toda categoria pertence a um usuário, inclusive categorias técnicas do sistema. Isso mantém o isolamento multi-tenant simples: toda leitura e escrita filtra por `userId` da sessão autenticada.

`isSystem` não significa "foi criada automaticamente". Significa que a categoria é estrutural para o funcionamento do sistema. Categorias default como "Alimentação" podem ser criadas pelo backend no onboarding, mas continuam sendo categorias do usuário e não são sistêmicas.

## Evento De Onboarding

O evento [user.created](../events/user-created.md) deve, futuramente, disparar a criação das categorias default do usuário. Esse consumidor ainda não foi implementado.
