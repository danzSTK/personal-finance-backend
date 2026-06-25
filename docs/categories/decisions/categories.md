---
area: categories
type: decision
status: current
related:
  - ../README.md
  - ../reference/visual-tokens.md
  - ../../events/user-created.md
  - ../../integrations/categories/README.md
---

# Categories Decisions

## Definição

Categoria é a classificação financeira de uma transaction.

Ela não é uma tag genérica. Ela representa a semântica do movimento financeiro: receita, despesa, transferência, ajuste ou investimento.

Uma categoria deve ajudar o sistema a responder:

- por que esse dinheiro saiu?
- por que esse dinheiro entrou?
- isso deve entrar em relatório de despesa ou receita?
- isso é uma transferência neutra entre contas do próprio usuário?
- isso é um ajuste técnico de saldo?

## O Que Categoria Não É

Categoria não deve representar tudo.

Não use categoria para representar:

- banco ou carteira, porque isso é `account`;
- pessoa, loja ou recebedor, porque isso deve ser `payee`, `merchant` ou contato;
- projeto específico demais, porque isso tende a ser `tag`;
- recorrência, porque isso deve ser regra de transaction recorrente;
- conta de origem/destino em transferência, porque isso pertence ao fluxo de accounts/transactions.

## Ownership

Toda categoria pertence a um usuário.

Mesmo categorias técnicas como `TRANSFER` e `ADJUSTMENT` devem ser criadas por usuário, não como registro global compartilhado. Isso evita queries com `user_id = X OR user_id IS NULL`, reduz risco de vazamento entre tenants e mantém as FKs simples.

O frontend nunca envia `userId`. O backend sempre usa o usuário autenticado.

## Nome Exibido E Nome Canônico

Categorias têm dois nomes:

| Campo         | Função                               | Exemplo       |
| ------------- | ------------------------------------ | ------------- |
| `displayName` | Texto exibido ao usuário             | `Alimentação` |
| `name`        | Nome canônico para busca e unicidade | `alimentacao` |

`name` é gerado pelo domínio a partir de `displayName`:

1. remove espaços nas pontas;
2. usa normalização Unicode `NFD`;
3. remove acentos;
4. converte para lowercase;
5. remove números e símbolos;
6. troca espaços por hífen;
7. compacta hífens repetidos.

Exemplos:

| `displayName`    | `name`           |
| ---------------- | ---------------- |
| `Alimentação`    | `alimentacao`    |
| `Cartão Crédito` | `cartao-credito` |
| `  SAÚDE  `      | `saude`          |

O `name` não aceita números. O padrão esperado é:

```text
^[a-z]+(-[a-z]+)*$
```

## Unicidade

Uma categoria ativa deve ser única por:

```text
userId + type + name
```

Categorias arquivadas podem ter o mesmo nome canônico de uma categoria ativa. Isso permite corrigir uma categoria criada errada sem bloquear uma nova categoria ativa.

Ao desarquivar, a mesma regra volta a valer. Se já existir uma categoria ativa com o mesmo `userId`, `type` e `name`, o backend retorna conflito.

## Tipos

### INCOME

Categoria de receita.

Usada para entradas de dinheiro, como salário, reembolso, venda ou rendimento recebido.

Transactions de receita devem usar categorias `INCOME`.

### EXPENSE

Categoria de despesa.

Usada para saídas de dinheiro de consumo ou obrigação, como mercado, aluguel, transporte, saúde e lazer.

Transactions de despesa devem usar categorias `EXPENSE`.

### INVESTMENT

Categoria de investimento.

Representa movimentos relacionados a investimento. A semântica final ainda pode evoluir conforme o módulo de investimentos amadurecer.

Na V0, pode existir como categoria gerenciável, mas relatórios precisam tratar investimento com cuidado para não misturar automaticamente com despesa comum.

### TRANSFER

Categoria técnica de transferência.

Usada para movimentos entre contas do próprio usuário. Transferência é neutra: não é receita e não é despesa.

Categorias `TRANSFER` são estruturais do sistema:

- `isSystem=true`;
- não aparecem nas telas comuns de gerenciamento;
- não podem ser criadas manualmente pelo usuário;
- não podem ser renomeadas;
- não podem ser arquivadas;
- não podem ser deletadas;
- devem ser usadas internamente por fluxos de transferência.

### ADJUSTMENT

Categoria técnica de ajuste.

Usada quando o usuário precisa corrigir saldo por uma transaction de ajuste, especialmente depois que a account já possui movimentações.

Importante: `initialBalanceCents` de account não precisa de categoria enquanto a conta ainda não teve movimentação. `initialBalanceCents` é ponto de abertura da conta. Ajustes posteriores devem ser transactions técnicas com categoria `ADJUSTMENT`.

Categorias `ADJUSTMENT` seguem a mesma proteção de `TRANSFER`.

## Categoria Sistêmica

`isSystem` significa que a aplicação depende estruturalmente da categoria.

Não significa "foi criada pelo sistema".

Categorias default visíveis, como possíveis categorias iniciais "Alimentação", "Moradia" ou "Salário", podem ser criadas automaticamente no onboarding, mas não são sistêmicas se o sistema não depende especificamente delas.

Regras de categoria sistêmica:

- não pode ser editada pelo usuário;
- não pode ser arquivada;
- não pode ser deletada;
- pode ser usada internamente por fluxos do sistema;
- normalmente não aparece nas telas comuns de gerenciamento.

## Categoria Técnica

Categoria técnica é derivada do tipo.

Hoje são técnicas:

- `TRANSFER`;
- `ADJUSTMENT`.

Essas categorias não aparecem em `GET /categories` nem em `GET /categories/:id`, porque essas rotas são de gerenciamento do usuário.

## Visibilidade

Visibilidade não é uma coluna separada.

A visibilidade de gerenciamento é regra de domínio:

```text
isVisibleInManagement = !isTechnical
```

Categorias técnicas podem aparecer em outros contextos no futuro, como detalhe de transaction técnica ou relatório de transferências, mas não aparecem no CRUD comum de categories.

## Edição

Uma categoria é editável quando:

```text
!isSystem && !isTechnical && !isArchived
```

Campos editáveis:

- `displayName`;
- `description`;
- `colorToken`;
- `iconKey`;
- `includeInReports`;
- `sortOrder`.

O tipo não é editável. Trocar uma categoria de `EXPENSE` para `INCOME`, por exemplo, alteraria a semântica das transactions antigas.

## Tokens Visuais

Categorias não salvam hexadecimal livre, SVG ou nome de componente de UI.

Elas salvam:

- `colorToken`;
- `iconKey`.

Esses valores pertencem ao catálogo oficial do backend e são documentados em [Category visual tokens](../reference/visual-tokens.md).

O objetivo é manter o banco independente da implementação visual do frontend. Hoje o frontend pode renderizar `iconKey=utensils` com Lucide React; no futuro esse mesmo token pode apontar para outro pacote ou SVG próprio sem migration.

O backend valida os tokens na criação e edição. O frontend pode buscar o catálogo em [GET /categories/metadata](../../integrations/categories/get-category-metadata.md).

## Arquivamento

Arquivar significa impedir uso futuro sem perder histórico.

Uma categoria arquivada:

- permanece vinculada às transactions antigas;
- não deve ser usada em novas transactions manuais;
- pode aparecer apenas quando o usuário pedir explicitamente categorias arquivadas;
- não é editável enquanto arquivada;
- pode ser desarquivada se não houver conflito de nome ativo.

Categorias sistêmicas e técnicas não podem ser arquivadas.

## Delete Simples

Uma categoria pode ser deletada diretamente quando:

- pertence ao usuário autenticado;
- não é sistêmica;
- não é técnica;
- não possui transactions vinculadas.

Essa rota existe para casos em que o usuário criou uma categoria errada e quer remover antes de qualquer uso.

## Delete Com Merge

Se a categoria possui transactions, ela não pode ser deletada diretamente.

Nesse caso o usuário pode deletar com merge:

1. escolhe uma categoria destino;
2. o backend valida se destino pertence ao mesmo usuário;
3. o backend valida se destino é ativa, gerenciável e do mesmo tipo;
4. todas as transactions da origem são movidas para o destino;
5. a categoria origem é deletada.

Essa operação deve ser atômica. Ou move todas as transactions e deleta a origem, ou não faz nada.

## Relatórios

`includeInReports` indica se uma categoria gerenciável deve entrar em relatórios agregados.

Essa flag não substitui a semântica do `type`.

Mesmo que exista algum erro operacional, `TRANSFER` nunca deve ser tratada como receita ou despesa comum. Relatórios financeiros devem respeitar o tipo da categoria.

## Onboarding E Categorias Default

Quando o evento [user.created](../../events/user-created.md) for consumido por categories, o backend deve criar categorias iniciais para o usuário.

Ainda não definimos a lista final de nomes, mas o desenho esperado é:

- categorias default visíveis de `INCOME`, `EXPENSE` e possivelmente `INVESTMENT`;
- categorias técnicas `TRANSFER` e `ADJUSTMENT`;
- tokens visuais oficiais para cada categoria default;
- idempotência por usuário e nome canônico;
- categorias default visíveis com `isSystem=false`;
- categorias técnicas com `isSystem=true`.

## Segurança

Toda operação de categoria deve filtrar por `userId` do usuário autenticado.

O frontend não deve enviar `userId`, e o backend não deve confiar em `userId` vindo do body.

## Questões Abertas

- nomes exatos das categorias default do onboarding;
- semântica final de `INVESTMENT`;
- como budgets/orçamentos serão vinculados às categorias;
- como categorias técnicas aparecerão em telas de detalhe de transaction;
- se relatórios terão telas específicas para `TRANSFER` e `ADJUSTMENT`.
