---
area: auth
type: decision
status: current
related:
  - ../flow/errors.md
  - ../redis-keys.md
  - ./hmac-key-fingerprints.md
---

# Limitador técnico separado da policy

## Decisão

Limitar IP e JTI no guard antes do bcrypt e manter bloqueio, cooldown e limite
diário no use case/policy por usuário.

## Motivos

- O guard protege capacidade computacional contra abuso.
- As regras por usuário precisam existir mesmo quando a proteção técnica estiver
  degradada.
- Limite técnico e regra de negócio possuem dimensões e disponibilidade
  diferentes.

## Consequências

- O guard pode permitir a requisição se apenas seu limitador técnico falhar.
- A policy falha de forma fechada se o estado operacional por usuário não puder
  ser garantido.
- O limite chamado de sessão é atualmente por JTI do access token.
