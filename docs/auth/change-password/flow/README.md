---
area: auth
type: flow
status: current
related:
  - ../decisions/README.md
  - ../redis-keys.md
  - ../lua-scripts.md
  - ../../reference/error-codes.md
  - ../../../specs/auth/change-password/specs/requirements.md
---

# Fluxos da alteração de senha

`POST /auth/password/change` recebe somente `currentPassword` e `newPassword`.
O usuário e o JTI do access token vêm do contexto autenticado; IP e dispositivo
são derivados da requisição e sanitizados.

`GET /auth/password/change/status` permite ao frontend consultar antecipadamente
se existe alguma restrição temporal. A resposta contém somente `status` booleano;
quando falso, `Retry-After` informa os segundos restantes sem revelar a causa.

## Cenários

- [Sucesso](./success.md): transação, reconstrução Redis e revogação de sessões.
- [Senha atual incorreta](./failed-attempts.md): contagem, primeiro bloqueio e
  reincidência.
- [Erros e restrições](./errors.md): códigos, status e condições de retry.

## Caminho principal

```mermaid
flowchart TD
  A[POST /auth/password/change] --> B[JwtAuthGuard valida usuário e token]
  B --> C[PasswordChangeCostGuard limita IP e JTI]
  C --> D[StateLoader consulta Redis]
  D -->|READY| E[Policy avalia restrições]
  D -->|MISSING| F[Carrega fatos no PostgreSQL]
  F --> G[Assembler reconstrói estado]
  G --> H[Replace atômico no Redis]
  H --> E
  D -->|PENDING| P[409 OPERATION_PENDING]
  D -->|Redis indisponível| Q[503 STATE_UNAVAILABLE]
  E -->|restrição ativa| R[429 com Retry-After]
  E -->|permitido| I[SET NX PX adquire barreira]
  I -->|ocupada| P
  I -->|adquirida| J[Transação PostgreSQL e lock do usuário]
  J --> K{Senha atual confere?}
  K -->|não| L[Persiste falha e talvez bloqueio]
  K -->|sim| M[Valida diferença e calcula novo hash]
  M --> N[Atualiza hash e credentialVersion]
  N --> O[Persiste auditoria e outbox]
  L --> S[Commit]
  O --> S
  S --> T[finally reconstrói toda a projeção Redis]
  T --> U{Resultado da transação}
  U -->|senha incorreta| V[403 CURRENT_PASSWORD_INVALID]
  U -->|bloqueio iniciado| W[429 PASSWORD_CHANGE_BLOCKED]
  U -->|senha alterada| X[Revoga sessões Redis imediatamente]
  X --> Y[Limpa cookies e retorna 200]
```

## Consulta de status

```mermaid
flowchart TD
  A[GET /auth/password/change/status] --> B[Guards globais e usuário autenticado]
  B --> C[StateLoader consulta Redis]
  C -->|MISSING| D[Reconstrói pelo PostgreSQL]
  D --> E[Policy avalia restrições]
  C -->|READY| E
  C -->|PENDING| F[status false + Retry-After]
  C -->|indisponível| G[503 STATE_UNAVAILABLE]
  E -->|permitido| H[status true]
  E -->|restrição ativa| F
```

A consulta usa somente o throttling global. Ela não passa pelo
`PasswordChangeCostGuard`, não cria barreira e não altera o orçamento técnico do
`POST`. Como o resultado não reserva a operação, o `POST` sempre reavalia o
estado antes do bcrypt.

## Fronteiras de responsabilidade

- Guards autenticam e limitam o custo técnico antes do bcrypt.
- A rota de status autentica e consulta, mas não consome o limite técnico do
  fluxo de mutação.
- O loader entrega à policy um estado operacional confiável.
- A policy decide regras usando apenas estado e horário.
- O use case coordena barreira, transação, domínio, outbox e efeitos pós-commit.
- PostgreSQL registra fatos; Redis acelera decisões e pode ser reconstruído.
- O worker repete reconciliação e revogação quando a via imediata falha.
