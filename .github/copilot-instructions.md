When performing a code review, respond in Português.

# Instruções de Revisão de Código — Sistema de Finanças Pessoais
# Lead Developer Mode | NestJS + DDD + SOLID + GoF

Responda **obrigatoriamente em Português**. Seja técnico, direto e construtivo.

---

## 1. Regras de Negócio Financeira

- **Precisão monetária:** Garanta o uso de `decimal.js` ou `big.js` para
  qualquer aritmética de saldo/valor. **Floats são proibidos para dinheiro.**
- **Integridade de transação:** Toda `Transaction` deve ter obrigatoriamente
  `userId`, `categoryId`, `accountId` e `date` — rejeite se ausente.
- **Validação de saldo:** Antes de persistir uma despesa, valide o saldo
  disponível. Retorne `400 Bad Request` com mensagem de domínio se insuficiente.
- **Imutabilidade:** Transações já conciliadas não devem ser alteradas;
  retorne `409 Conflict` se houver tentativa.

---

## 2. DDD — Camada de Domínio

- **Entidades de domínio vs. entidades de persistência:** Verifique se o
  código separa `Domain Entities` (com comportamento e invariantes) de
  `Persistence Entities` (TypeORM). Mapeadores (`Mapper`) devem existir
  entre as camadas.
- **Value Objects:** Valores como `Money`, `Email`, `DateRange` devem ser
  modelados como Value Objects imutáveis, não como primitivos soltos.
- **Invariantes no domínio:** Regras de negócio (ex: saldo não pode ser
  negativo) devem estar dentro da entidade/VO de domínio, não no Service.
- **Domain Exceptions:** O domínio deve lançar exceções próprias
  (ex: `InsufficientBalanceException`, `InvalidTransactionDateException`).
  **Nunca lançar `HttpException` dentro da camada de domínio.**
- **Domain Events:** Operações relevantes (ex: `TransactionCreatedEvent`,
  `PasswordChangedEvent`) devem emitir eventos de domínio para desacoplar
  side-effects (ex: invalidar cache, enviar notificação).
- **Bounded Contexts:** Cada módulo NestJS deve representar um contexto
  delimitado claro. Verifique se módulos estão se comunicando por interfaces
  ou eventos, não por importação direta de repositórios alheios.

---

## 3. SOLID

- **SRP:** Services não devem acumular responsabilidades. Se um Service faz
  mais de uma coisa (ex: autentica E envia e-mail), questione a divisão.
- **OCP:** Estratégias de cálculo ou notificação devem ser extensíveis sem
  modificar o núcleo. Verifique se o padrão Strategy (GoF) foi considerado.
- **LSP:** Subclasses/implementações de interfaces devem ser substituíveis
  sem quebrar o contrato.
- **ISP:** Interfaces de repositório não devem forçar a implementação de
  métodos irrelevantes. Prefira interfaces granulares por caso de uso.
- **DIP:** Services de domínio devem depender de abstrações (interfaces),
  não de implementações concretas (ex: `ITransactionRepository`, não
  `TransactionRepository` diretamente).

---

## 4. Padrões GoF Relevantes para o Projeto

- **Repository (GoF + DDD):** Confirme que a interface do repositório está
  definida no domínio e a implementação TypeORM está na infraestrutura.
- **Strategy:** Lógica de cálculo (ex: taxa de câmbio, tipo de recorrência)
  deve usar Strategy em vez de `if/else` encadeado.
- **Factory:** Criação de entidades complexas (ex: `Transaction` com várias
  validações) deve usar Factory Method ou Abstract Factory.
- **Decorator (GoF):** Lógica transversal (logging, cache, retry) deve usar
  Decorator ou interceptors NestJS, não poluir o Service.
- **Observer/Events:** Side-effects pós-transação devem usar o padrão
  Observer via `EventEmitter2` ou `@nestjs/cqrs`, não chamadas diretas.
- **Facade:** Se um caso de uso orquestra muitos serviços, um `UseCase` ou
  `ApplicationService` deve funcionar como Facade, expondo uma única entrada.

---

## 5. Camada de Aplicação (Use Cases)

- **Use Cases explícitos:** Cada operação de negócio deve ter um Use Case
  dedicado (ex: `CreateTransactionUseCase`, `ChangePasswordUseCase`).
  Use Cases orquestram domínio + infraestrutura, mas não contêm lógica de negócio.
- **CQRS (opcional, mas incentivado):** Para operações de leitura intensiva,
  considere separar Commands de Queries. Questione se `@nestjs/cqrs` já foi
  avaliado dado o crescimento do projeto.
- **Controllers são finos:** Controllers só devem deserializar request,
  chamar o Use Case e serializar a response. **Nenhuma lógica de negócio
  em controllers.**

---

## 6. Redis, Cache e Estado

- **Logout/Troca de Senha:** Verifique se `jti` é removido da whitelist e
  do session set no Redis via `REDIS_CLIENT` (ioredis). Cache de usuário/auth
  deve ser invalidado.
- **Cache de leitura:** Endpoints intensivos (`GET /transactions`,
  `GET /categories`) devem usar `CACHE_MANAGER` com TTL de 5 minutos.
- **Invalidação após escrita:** Após `CREATE/UPDATE/DELETE`, as keys
  `user:{userId}:transactions` devem ser invalidadas. Verifique
  case-sensitivity nas keys.
- **Abstração correta:** `REDIS_CLIENT` (ioredis) para operações complexas
  (sets, pipelines, TTL manual). `CACHE_MANAGER` para cache simples de
  resposta.
- **Consistência eventual:** O sistema deve tolerar dados levemente
  desatualizados vindos do cache. Garanta que dados críticos (saldo,
  autenticação) são sempre lidos do banco, nunca apenas do cache.

---

## 7. Segurança e Autenticação

- **Ownership obrigatório:** Todo repository/service deve filtrar por
  `userId` extraído do **token JWT**, nunca do corpo da requisição.
- **@CurrentUser():** Use o decorator `@CurrentUser()` para acessar o
  usuário autenticado nos controllers.
- **Campos sensíveis:** `passwordHash`, `refreshTokenHash` e segredos
  OAuth devem ter `{ select: false }` na entidade TypeORM.
- **Erros internos:** Nunca exponha stack trace ou mensagem de banco.
  Use `InternalServerErrorException` ou exceções de domínio traduzidas
  no controller/exception-filter.
- **Rate Limiting:** Endpoints de autenticação (`/auth/login`,
  `/auth/refresh`) devem ter throttle mais restritivo configurado via
  `@nestjs/throttler`.

---

## 8. NestJS / TypeORM / DTOs

- **Migrações:** Toda nova coluna ou mudança de schema deve ter migração
  TypeORM correspondente. Rejeite PRs que alterem entidades sem migração.
- **DTOs completos:** Todos os campos devem ter decorators `class-validator`
  e `class-transformer`. `@Type()` obrigatório em campos numéricos/datas.
- **Async/Await:** Toda operação I/O (DB, Redis, HTTP externo) deve ser
  corretamente `await`ada. Bloqueios síncronos são proibidos.
- **Exception Filters:** Traduza Domain Exceptions para HTTP exceptions
  em um `ExceptionFilter` global, mantendo o domínio agnóstico de HTTP.

---

## 9. Testes

- **Cobertura mínima:** Use Cases e Domain Entities devem ter testes
  unitários. Services de infraestrutura devem ter testes de integração.
- **Mocks de repositório:** Testes de Use Case devem mockar a interface
  `IRepository`, não a implementação TypeORM.
- **Testes de domínio são puros:** Nenhum teste de entidade/VO deve
  instanciar o NestJS testing module — devem ser Node.js puro.

---

## 10. Evolução Futura (alertar o autor se o PR dificultar)

Questione se a implementação fecha a porta para:
- Multi-currency (uso de `Money` VO resolve isso)
- Transações recorrentes (Strategy de recorrência)
- Budgets e relatórios (leitura separada de escrita facilita)
- Auditoria de alterações (Domain Events facilitam)
