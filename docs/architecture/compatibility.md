---
area: architecture
type: compatibility-register
status: current
related:
  - ../database/schema.md
  - ../database/migration-rollout.md
  - ../platform/continuous-delivery.md
---

# Compatibilidade De Migrations

O padrão arquitetural de evolução está em
[`docs/database/migration-rollout.md`](../database/migration-rollout.md). Este
documento é o registro vinculante das compatibilidades temporárias de banco.
Ele não descreve apenas o schema atual: registra quais versões de código ainda
precisam funcionar durante deploy e rollback, por que um shim existe e exatamente
quando e como ele pode ser removido.

O deploy executa migrations antes de ativar API e worker e não reverte migrations
automaticamente durante rollback. Portanto, toda migration deve considerar duas
imagens:

- **code N**: imagem ativa imediatamente antes do deploy e ainda elegível para
  rollback;
- **code N+1**: imagem que será ativada depois da migration.

## Modelo Expand -> Migrate -> Contract

1. **Expand:** adicionar schema e mecanismos temporários de modo que code N
   continue funcionando depois da migration. Exemplos: coluna nullable, default
   compatível, dual-read, dual-write ou constraint inicialmente permissiva.
2. **Migrate:** publicar code N+1, preencher/normalizar dados e observar o uso do
   novo formato enquanto a compatibilidade permanece ativa.
3. **Contract:** em release posterior, remover o shim ou apertar a invariante
   somente depois que code N sair da janela de rollback e o critério registrado
   neste documento estiver comprovado.

DROP, RENAME, `NOT NULL`, alterações de enum/check constraint, mudanças de formato
persistido e novas obrigatoriedades nunca devem ser tratadas como uma troca
atômica de schema e imagem.

## Matriz Obrigatória

Toda migration nova ou alterada deve responder na spec e no review:

| Pergunta                               | Resposta exigida                 |
| -------------------------------------- | -------------------------------- |
| Code N funciona antes da migration?    | baseline                         |
| Code N funciona depois da migration?   | sim para rollback                |
| Code N+1 funciona antes da migration?  | sim ou ordem de deploy explícita |
| Code N+1 funciona depois da migration? | sim                              |

Qualquer resposta `não` exige fases separadas, ordem de rollout documentada e um
mecanismo que preserve rollback. Não é permitido remover o mecanismo na mesma
release em que ele foi introduzido.

## Contratos Ativos

| ID              | Compatibilidade                                               | Introduzida em                                     | Remoção mais cedo                                                    | Estado          |
| --------------- | ------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | --------------- |
| `DB-COMPAT-001` | default de `email_verification_challenges.origin` para code N | unreleased, PR #85; confirmar tag na PR de release | não agendada; bloqueada enquanto v0.1.3 puder ser imagem de rollback | `EXPAND_ACTIVE` |

### DB-COMPAT-001 - Default legado de `email_verification_challenges.origin`

**Contexto.** A feature de verificação passa a persistir `origin`, mas a imagem
N (`v0.1.3`) não envia essa coluna ao inserir um challenge. A migration roda antes
da imagem N+1 e permanece aplicada se houver rollback.

**Expand.** A migration `1787616000000-AddEmailVerificationResendState` adiciona,
faz backfill e mantém `origin varchar(30) NOT NULL DEFAULT 'LEGACY_UNKNOWN'`.
Code N continua inserindo; code N+1 declara `AUTOMATIC` ou `MANUAL_RESEND`.

| Combinação                   | Compatível? | Motivo/ordem                                                       |
| ---------------------------- | ----------- | ------------------------------------------------------------------ |
| code N antes da migration    | sim         | comportamento anterior                                             |
| code N depois da migration   | sim         | o default preenche a coluna omitida                                |
| code N+1 antes da migration  | não         | o novo mapper depende da coluna; executar expand antes da ativação |
| code N+1 depois da migration | sim         | a aplicação grava origem explícita                                 |

**Migrate/observação.** Registros anteriores e inserts feitos por code N recebem
`LEGACY_UNKNOWN`. Novas escritas de code N+1 não dependem do default. A tag real
que introduzir a mudança deve substituir `unreleased` neste registro.

**Gate de remoção.** O contract permanece bloqueado até o histórico de produção
confirmar que `v0.1.3` e qualquer outra imagem que omita `origin` não podem mais
ser selecionadas pelo rollback. Enquanto a versão mínima de remoção não estiver
registrada, o default é obrigatório.

**Contract exato.** Criar uma nova migration, nunca editar a expand já aplicada,
com:

```sql
ALTER TABLE "email_verification_challenges"
ALTER COLUMN "origin" DROP DEFAULT;
```

Na mesma mudança, remover `default 'LEGACY_UNKNOWN'` de
`docs/database/schema.md`, atualizar este contrato com a tag de remoção e marcar
o estado como `RETIRED`. A constraint e o valor `LEGACY_UNKNOWN` permanecem até
uma decisão separada provar que não existem linhas nem leitores dependentes.

## Registro De Novos Contratos

Cada compatibilidade nova deve registrar:

- identificador estável e estado (`EXPAND_ACTIVE`, `MIGRATING`, `READY_TO_CONTRACT` ou `RETIRED`);
- migration e release que introduziram a expansão;
- matriz N/N+1 e ordem de deploy/rollback;
- mecanismo temporário e telemetria ou consulta que comprova sua aposentadoria;
- versão mínima e condição objetiva de remoção;
- SQL, código, configuração e documentação exatos que o contract removerá.

Uma PR de contract deve apontar para o ID, demonstrar o gate e atualizar este
registro. Ausência de evidência mantém o contrato ativo.
