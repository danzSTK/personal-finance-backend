---
area: database
type: architecture
status: current
related:
  - ./schema.md
  - ../architecture/compatibility.md
  - ../platform/continuous-delivery.md
---

# Rollout De Migrations

Toda evolução do banco deste backend segue `expand -> migrate -> contract`.
Esse é um requisito arquitetural porque o deploy executa migrations antes de
ativar a nova imagem e um rollback da aplicação não reverte o banco.

O objetivo não é fazer toda combinação funcionar indefinidamente. É tornar a
ordem de deploy explícita, manter code N funcional depois da expansão e adiar
mudanças destrutivas até que code N deixe de ser uma opção de rollback.

## Quando Aplicar

O fluxo é obrigatório para toda migration e merece atenção especial quando a
mudança:

- executa `DROP` ou `RENAME`;
- adiciona `NOT NULL` ou uma nova obrigatoriedade;
- altera enum, domínio ou check constraint;
- muda formato, unidade, significado ou codificação persistida;
- troca chave, relacionamento, índice unique ou regra de integridade;
- remove default, coluna auxiliar, dual-read, dual-write ou outro shim.

## Fases

### 1. Expand

Adicionar uma representação que code N tolere depois da migration e que code N+1
possa adotar. Conforme o caso, usar coluna nullable, default compatível, novo
campo paralelo, constraint permissiva, dual-read ou dual-write.

A expansão deve evitar reescritas longas e locks não avaliados. Backfill grande
ou operação não transacional deve ter estratégia própria, tamanho de lote,
observabilidade e recuperação documentados.

### 2. Migrate

Ativar code N+1 depois da expansão, preencher ou converter dados existentes e
observar se leitores/escritores antigos ainda usam o shim. A migration de dados
pode ser SQL, job ou processo operacional, mas precisa ser repetível ou possuir
checkpoint seguro quando não couber em uma única transação curta.

O mecanismo temporário permanece enquanto code N estiver na janela de rollback.

### 3. Contract

Remover o formato antigo ou apertar a invariante em uma release posterior. O
contract exige evidência do gate registrado e uma migration nova; não se edita a
migration expand já aplicada.

Exemplos de contract: `DROP COLUMN`, `DROP DEFAULT`, `SET NOT NULL`, remoção de
valor legado de check/enum e encerramento de dual-read/dual-write.

## Análise N/N+1 Obrigatória

Antes de escrever SQL, responder:

1. Code N funciona depois desta migration?
2. Code N+1 funciona antes dela?
3. Code N+1 funciona depois dela?
4. Qual é a ordem exata de migration, ativação e rollback?

Code N depois da expansão e code N+1 depois da migration devem funcionar. Se
code N+1 não funciona antes, o deploy deve executar a expansão antes de ativá-lo.
Se code N não funciona depois, a mudança ainda não possui uma expansão segura e
deve ser dividida.

## Contrato Documental

Quando uma fase deixa compatibilidade temporária, registrar em
`docs/architecture/compatibility.md`:

- ID e estado do contrato;
- migration e release de introdução;
- matriz N/N+1;
- ordem de deploy e rollback;
- mecanismo temporário;
- critério e versão mínima de remoção;
- limpeza exata de SQL, código, configuração e documentação.

`docs/database/schema.md` descreve o estado atual, inclusive defaults e
constraints temporários. O registro de compatibilidade explica por que eles não
podem ser removidos ainda.

## Validação

Na proporção do risco, validar:

- SQL e locks esperados antes da execução;
- `up`, `down` e novo `up` quando o rollback da migration é suportado;
- escrita/leitura equivalentes a code N depois da expansão;
- code N+1 no schema expandido;
- backfill, valores nulos, defaults, constraints e índices em PostgreSQL real;
- ordem de deploy e caminho de rollback descritos na spec;
- atualização simultânea de `schema.md` e do registro de compatibilidade.

Passar build e testes apenas com code N+1 não demonstra compatibilidade de
rollback. O teste ou revisão precisa observar explicitamente o comportamento que
code N ainda executará.
