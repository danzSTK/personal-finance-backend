---
area: auth
type: decision
status: current
related:
  - ./technical-cost-limiter.md
  - ./sanitized-security-context.md
---

# IP derivado da cadeia de proxies confiáveis

## Decisão

Resolver o IP por `request.ip`, com fallback do socket, e configurar
`trust proxy` conforme a topologia. A aplicação não interpreta diretamente os
headers encaminhados.

## Motivos

- `X-Forwarded-For`, `CF-Connecting-IP` e similares podem ser forjados quando o
  proxy confiável não os sobrescreve.
- O framework já aplica a política configurada de proxies ao produzir
  `request.ip`.

## Consequências

- A configuração de produção pressupõe exatamente a cadeia de proxies
  documentada.
- Mudança de topologia exige revisão de `trust proxy`.
- IP continua sendo apenas um sinal técnico, não uma identidade do usuário.
