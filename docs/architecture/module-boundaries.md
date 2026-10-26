---
area: architecture
type: reference
status: current
last_reviewed: 2026-10-26
---

# Limites Entre Módulos (Module Boundaries)

Este documento estabelece as regras de fronteira, dependência e comunicação entre os módulos de domínio em `api/src/modules/` da Danfy.

O objetivo desta governança é manter o acoplamento controlado, permitindo que cada módulo evolua com estabilidade, sem vazamento de regras de persistência ou infraestrutura para outros domínios.

---

## 1. Princípios Fundamentais

1. **Autonomia de Bounded Contexts:** Cada módulo em `api/src/modules/<modulo>/` é responsável pelo seu próprio ciclo de vida, persistência e invariantes de negócio.
2. **Direção de Dependência:**
   - O Domínio (`domain/`) de um módulo nunca importa código de outros módulos.
   - A Aplicação (`application/`) de um módulo só pode se comunicar com outro módulo por **portas públicas de aplicação** ou **eventos assíncronos**.
   - Use cases nunca devem manipular repositórios internos de outros domínios.
3. **Proibição de Mutações Cruzadas:** Um módulo nunca grava, atualiza ou deleta dados nas tabelas de outro módulo sem passar pelos casos de uso ou mecanismos públicos do módulo proprietário.

---

## 2. Padrão Arquitetural para Assets e Arquivos Externos

A gestão de arquivos (comprovantes, avatares, anexos) ilustra a separação rigorosa de fronteiras entre **negócio** e **armazenamento físico**:

### 2.1. Responsabilidade dos Módulos Consumidores (`users`, `transactions`, etc.)
- Armazenam apenas a chave estrangeira lógica (`avatar_asset_id`, `asset_id`).
- Não conhecem buckets, SDK S3, Cloudflare R2, Content-Type técnico ou checksums.
- Ao excluir ou substituir uma entidade/vínculo, realizam apenas duas operações na sua transação local do PostgreSQL:
  1. Atualizam sua própria entidade de negócio (ex.: soft delete da transação ou `avatar_asset_id = NULL`);
  2. Atualizam o registro em `assets` para `status = 'DELETE_PENDING'`.
- NUNCA realizam I/O de rede ou chamadas ao Object Storage diretamente.

### 2.2. Responsabilidade do Módulo de Assets (`assets`)
- É a fonte única da verdade para identidade, localização, status, integridade e ciclo de vida do arquivo.
- O serviço em background no Worker (`AssetReconcilerService`) é o **único responsável** por processar `DELETE_PENDING`, invocar a desalocação física idempotente no Cloudflare R2 e registrar a conclusão com `DELETED` e `deleted_at = now()`.
- Falhas de infraestrutura no Object Storage ficam isoladas no módulo de assets e não quebram a consistência das entidades financeiras ou de usuários.

---

## 3. Exceções Pragmáticas Toleradas no Monólito

Em um monólito modular com TypeORM e NestJS, algumas exceções de fronteira são pragmaticamente toleradas para evitar complexidade excessiva de infraestrutura:

1. **Relações no TypeORM (`*OrmEntity`):**  
   Entidades de persistência (`infrastructure/persistence/`) podem mapear relacionamentos `@ManyToOne` e `@OneToMany` com entidades ORM de outros módulos.  
   *Justificativa:* Necessário para geração automática de Foreign Keys reais no PostgreSQL com constraints de integridade referencial (`ON DELETE RESTRICT`) e suporte a queries relacionais no banco. Isso fica confinado à infraestrutura e não vaza para as entidades de domínio.
2. **Tipagem de `@CurrentUser() user: User` nos Controllers:**  
   Controllers importam a classe `User` de `@/modules/users/domain` para tipar o usuário autenticado injetado pelo Passport/JWT Guard.  
   *Justificativa:* Conveniência de framework para acesso a `user.id`.

---

## 4. Dívida Técnica Registrada (Para Estudo e Refatoração Futura)

Esta seção registra explicitamente os acoplamentos existentes no código que divergem da arquitetura ideal, mantidos temporariamente para estudo aprofundado antes de qualquer refatoração:

### DT-01: Use Cases Injetando Repositórios de Outros Módulos
- **Onde ocorre:**
  - `UpdateUserAvatarUseCase` (em `users`) injeta diretamente `IAssetRepository` (de `assets`).
  - `TransactionReferenceValidatorService` (em `transactions`) injeta diretamente `IAccountRepository` e `ICategoryRepository`.
- **Por que é dívida técnica:** Repositórios de domínio expõem contratos de persistência internos. Um use case de transações não deveria ter acesso a métodos como `accountRepository.save()`.
- **Direção futura:** Módulos consumidores devem injetar apenas **Application Ports / Facades públicas** (ex.: `AccountLookupPort.assertAccountActive(...)`), sem acesso à persistência interna do outro módulo.

### DT-02: Repositórios Consultando Tabelas Alheias
- **Onde ocorre:**
  - `AccountRepository` e `CategoryRepository` realizam queries diretas na tabela `transactions`.
- **Por que é dívida técnica:** Um repositório de agregados não deveria acoplar seu SQL às tabelas de outro agregado para checar bloqueios ou regras de validação.
- **Direção futura:** Validações de integridade de deleção devem ser coordenadas pela camada de aplicação através de portas de consulta (ex.: `ITransactionQueryPort.hasTransactions(...)`). O cálculo de saldo (`AccountBalanceRepository`) deve ser formalizado como um serviço de projeção/leitura analítica (CQRS).

### DT-03: Tipagem do Usuário Autenticado na Apresentação
- **Onde ocorre:**
  - Controllers de `accounts`, `categories`, `transactions` e `auth` importam a entidade de domínio `User` apenas para ler `user.id`.
- **Direção futura:** Criar em `@/common/interfaces/` uma interface leve `AuthenticatedUser { readonly id: string; readonly email: string; }`, desacoplando todos os controllers da entidade de domínio do módulo `users`.
