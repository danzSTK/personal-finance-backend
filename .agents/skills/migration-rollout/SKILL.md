---
name: migration-rollout
description: Planejar, criar, gerar, revisar, executar ou remover migrations TypeORM deste backend com compatibilidade de deploy e rollback no modelo expand, migrate e contract. Use sempre que uma tarefa envolver migration ou mudança de schema persistido; não use para consultas SQL que não alteram schema ou formato persistido.
---

# Migration Rollout

Construa migrations que permitam ativar code N+1 e ainda reverter a aplicação para
code N sem reverter o banco.

## Fontes Obrigatórias

Antes de planejar ou editar SQL, leia completamente:

1. `docs/database/migration-rollout.md` para o processo arquitetural;
2. `docs/architecture/compatibility.md` para shims ativos e contracts bloqueados;
3. `docs/database/schema.md` e as migrations relevantes para o estado atual;
4. a spec da feature e as ORM entities afetadas.

Leia `docs/platform/continuous-delivery.md` quando a ordem de deploy, rollback,
lock ou duração operacional influenciar a decisão.

## Decisão De Rollout

Classifique a mudança antes de implementar:

- **Expand:** adição compatível necessária agora.
- **Migrate:** código/backfill que adota e popula a nova representação.
- **Contract:** remoção ou endurecimento liberado por um contrato existente.

Para `DROP`, `RENAME`, `NOT NULL`, enum/check constraint, formato persistido,
nova obrigatoriedade ou remoção de shim, responda explicitamente:

- Code N funciona depois desta migration?
- Code N+1 funciona antes dela?
- Code N+1 funciona depois dela?
- Qual é a ordem de migration, ativação e rollback?

Se code N falha depois, não existe expansão segura: divida a mudança. Se code N+1
falha antes, registre que a expansão precede a ativação. Não execute contract na
mesma janela em que code N ainda pode ser usado para rollback.

## Implementação

1. Atualize `requirements.md`, `design.md`, `tasks.md` e `decisions.md` da spec
   aplicável antes do SQL quando o rollout ou contrato mudar.
2. Modele a expansão mínima. Prefira mecanismos temporários explícitos a uma
   troca atômica presumida.
3. Registre qualquer default, dual-read, dual-write, campo legado ou constraint
   permissiva em `docs/architecture/compatibility.md`, incluindo versão, matriz
   N/N+1, gate objetivo e limpeza exata.
4. Altere ORM entity e crie uma migration incremental seguindo as convenções
   existentes. Nunca edite uma migration aplicada.
5. Atualize `docs/database/schema.md` com o estado realmente implantado,
   inclusive shims temporários.
6. Para contract, exija o ID `READY_TO_CONTRACT`, evidência do gate e uma nova
   migration; depois marque o registro `RETIRED` com a versão de remoção.

Antes de backfill grande, índice/constraint potencialmente bloqueante ou SQL não
transacional, determine volume, tipo/duração de lock, estratégia de lote,
observabilidade e recuperação. Pare e peça decisão se esses dados não estiverem
disponíveis e a escolha puder afetar produção.

## Validação

Valide a migration em PostgreSQL real na proporção do risco:

- `up/down/up` quando suportado;
- constraints, defaults, backfill e índices;
- operação equivalente a code N depois da expansão;
- code N+1 no schema expandido;
- ordem de deploy/rollback e contract documental.

Build e testes apenas da imagem N+1 não comprovam compatibilidade. Finalize
informando a matriz N/N+1, o contrato criado/consumido e qualquer limpeza adiada.
