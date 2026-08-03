---
area: auth
type: decision
status: current
related:
  - ../flow/errors.md
  - ./facts-versus-derived-restrictions.md
---

# Policy pura e maior tempo de retry

## Decisão

`ChangePasswordPolicy` recebe estado e horário, sem acessar Redis, PostgreSQL ou
NestJS. Quando várias restrições estão ativas, retorna o maior `retryAt`.

## Motivos

- Regras de negócio precisam permanecer testáveis sem infraestrutura.
- Um retry menor poderia induzir o cliente a tentar enquanto outra restrição
  ainda estivesse ativa.

## Consequências

- Loader e assembler preparam o contexto antes da policy.
- O use case converte a decisão em erro de aplicação.
- `Retry-After` representa o instante que realmente libera todas as restrições
  conhecidas.
