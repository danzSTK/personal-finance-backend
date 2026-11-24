# Checklist de Revisao Arquitetural e de Invariantes (Danfy)

Use esta referencia durante o `danfy-review` para validar aderencia arquitetural sem gerar falsos positivos.

---

## 1. Camadas e Direcao de Dependencia

- **Domain (`modules/<m>/domain/`):**
  - proibido importar `@nestjs/common`, `HttpException`, `typeorm`, `ioredis`, `bullmq`, `@aws-sdk/*` ou entidades ORM;
  - regras de negocio vivem em entities/value-objects/factories, nunca espalhadas em controllers ou use cases;
  - invariantes violadas lancam subclasses de `DomainError`;
  - `create()` valida/normaliza; `reconstitute()` hidrata dados confiaveis sem revalidar regras mutaveis;
  - limites de validacao usam constantes centralizadas em `@/common/models/constants`.
- **Application (`modules/<m>/application/`):**
  - um diretorio por use case (`<action>.use-case.ts` + `<action>.dto.ts` com interfaces TS puras, sem `class-validator`);
  - injeta interfaces de repositorio do proprio modulo ou portas publicas de aplicacao de outros modulos — nunca repositorios TypeORM/cached concretos;
  - falhas de orquestracao lancam subclasses de `ApplicationError` (nunca novos `HttpException` do NestJS).
- **Infrastructure (`modules/<m>/infrastructure/`):**
  - entidades ORM (`*-orm.entity.ts` / `*-orm-entity.ts`) ficam confinadas a `infrastructure/persistence/`;
  - mappers usam `reconstitute()` em `toDomain()` e extraem primitivos em `toPersistence()`;
  - imports internos usam alias `@/` (nunca `src/*`).
- **Presentation (`modules/<m>/presentation/`):**
  - controllers sao finos: recebem DTO validado, extraem `@CurrentUser()`, chamam use case e retornam Response DTO;
  - nunca retornam entidades de dominio ou ORM diretamente;
  - Response DTOs declaram propriedade `object` com valor centralizado em `@/common/models/constants`.

---

## 2. Limites Entre Modulos e Divida Tecnica Registrada

Consulte `docs/architecture/module-boundaries.md` antes de sinalizar acoplamento:

- **Bloqueie sempre em codigo novo ou alterado:**
  - `domain/` importando outro modulo;
  - mutacoes diretas em tabelas pertencentes a outro modulo fora dos mecanismos publicos do proprietario;
  - uso de `IObjectStorage` / S3 SDK / Cloudflare R2 fora de `api/src/modules/assets/`;
  - novos use cases injetando repositorios de dominio de outro modulo (devem usar portas publicas de aplicacao ou eventos);
  - novos repositorios consultando tabelas de outro agregado sem porta de leitura definida.
- **Excecoes pragmaticas toleradas (NAO sinalizar como bug):**
  - `@ManyToOne` / `@OneToMany` entre `*OrmEntity` exclusivamente dentro de `infrastructure/persistence/` para FKs reais no PostgreSQL;
  - tipagem `@CurrentUser() user: User` nos controllers enquanto `DT-03` estiver aberto;
  - ocorrencias legadas ja registradas em `DT-01` e `DT-02` quando nao forem expandidas pelo diff.

---

## 3. Separacao de Processos (`API` vs `Worker`)

- `PROCESS_ROLE=api` atende trafego HTTP sincrono e grava intencoes/eventos na transacao PostgreSQL.
- `PROCESS_ROLE=worker` processa Transactional Outbox, filas BullMQ e reconciliadores (`AssetReconcilerService`, `EmailMessageEnqueueReconciler`), sem expor porta HTTP publica.
- Sinalize se o PR:
  - importar/ativar consumidores de fila ou reconciliadores periodicos no grafo da API (`ApiModule`);
  - acoplar `HttpException` ou contexto HTTP a handlers/processors executados no worker;
  - misturar Redis de cache/sessao com Redis BullMQ (`noeviction`).

---

## 4. Transacoes, Cache e Efeitos Externos Duraveis

- **Transacoes:** multiplas escritas ou fluxos read-modify-write devem rodar na mesma transacao com `options.manager` propagado a **todos** os repositorios participantes e locks adequados (`FOR UPDATE` / `SKIP LOCKED`).
- **Cache (`Cached*Repository`):**
  - chaves criadas exclusivamente via `CacheKeys` (`@/common/utils/cache-keys.factory`);
  - leituras devem contornar o cache quando `options?.manager` estiver ativo;
  - escritas/delecoes devem invalidar todas as chaves afetadas imediatamente;
  - cache nunca pode ser tratado como fonte da verdade.
- **Efeitos externos duraveis:**
  - eventos derivados de estado usam Transactional Outbox na mesma transacao do banco;
  - exclusao de arquivo marca `DELETE_PENDING` na transacao e delega remocao fisica ao `AssetReconcilerService`;
  - envio de e-mail persiste intencao em `email_messages` com idempotencia e reconciliacao;
  - handlers e jobs devem tolerar semantica **at-least-once** (idempotencia).

---

## 5. Invariantes Financeiras e Temporais

- **Financeiro:**
  - valores monetarios exclusivamente em centavos inteiros seguros (`amountCents`, `initialBalanceCents`, `Number.isSafeInteger()`, PostgreSQL `bigint`); nunca float;
  - `transactions.amount_cents > 0` sempre (direcao vem de `type`/`direction`);
  - saldo de `accounts` e derivado do historico (`EFFECTIVE` e `deleted_at IS NULL`); nunca adicionar coluna mutavel de saldo sem decisao arquitetural;
  - `TRANSFER` nao pode ser deletada na V0; exclusao comum e soft delete (`deleted_at`).
- **Temporal:**
  - `DateOnly` (`YYYY-MM-DD`) nunca convertido para `Date` nem serializado com `toISOString().slice(0, 10)`; persistido em coluna `date`;
  - `Instant` persistido em `timestamptz` e serializado em ISO 8601 UTC.

---

## 6. Erros, Contratos e Testes

- **Erros:** novos erros seguem `platform-errors`, com `code` estavel mapeado em `AppExceptionFilter` e sem vazar stack trace ou erro cru do Postgres.
- **Contratos HTTP/Eventos/Filas:** mudancas devem ser aditivas ou explicitamente versionadas/migradas; campos renomeados ou removidos sem migracao sao `P0`/`P1`.
- **Testes:** verificar se o PR testa o caminho de sucesso **e** as falhas/bordas introduzidas na camada correta (unit puro no dominio, portas mockadas em use cases, Testcontainers para Postgres/Redis/BullMQ, E2E para HTTP/guards/filtros), sem `setTimeout` nem mocks que escondam a logica alterada.
