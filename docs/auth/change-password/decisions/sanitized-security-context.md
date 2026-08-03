---
area: auth
type: decision
status: current
related:
  - ../flow/README.md
  - ./trusted-client-ip.md
---

# Contexto de segurança sanitizado

## Decisão

Limitar User-Agent e valores de metadata, aceitar somente chaves conhecidas e
reduzir o payload dos eventos de notificação ao contexto necessário.

## Motivos

- Auditoria, outbox e notificações possuem retenção e leitores diferentes.
- Campos livres podem se tornar canais secundários de credenciais ou dados
  excessivos.
- O e-mail futuro precisa de contexto de segurança, não do conteúdo da sessão.

## Consequências

- Senha, hash, JWT, JTI, cookie e mutation token não entram nos eventos de
  notificação.
- Valores acima dos limites são truncados antes da persistência/publicação.
- Novas chaves de metadata exigem decisão explícita e atualização da allowlist.
