---
area: auth
feature: email-verification
type: index
status: current
related:
  - ../../specs/auth/email-verification/specs/requirements.md
  - ../../specs/auth/email-verification/specs/design.md
  - ../../integrations/auth/email-verification.md
---

# Email Verification

Documentação interna da política de verificação e reenvio de e-mail.

Esta pasta descreve a política operacional implementada pela issue 76. O
contrato público para o frontend está em
`docs/integrations/auth/email-verification.md`.

## Mapa

- [Chaves Redis](./redis-keys.md): conteúdo, escopo, TTL e comportamento quando
  as chaves estão ausentes.
- [Scripts Lua](./lua-scripts.md): contrato individual de cada transição atômica,
  incluindo quando é chamada e como responde.
- [Requirements](../../specs/auth/email-verification/specs/requirements.md):
  comportamento aprovado.
- [Design](../../specs/auth/email-verification/specs/design.md): arquitetura,
  API, schema, falhas e testes.
- [Decisions](../../specs/auth/email-verification/specs/decisions.md): decisões e
  alternativas consideradas.

## Resumo Da Política

- envio automático inicia cooldown de 60 segundos e não consome limite manual;
- até cinco resends manuais em janela móvel de 24 horas;
- cooldowns manuais de 120, 240, 480, 600 e 600 segundos;
- estado Redis ausente é interpretado como vazio;
- Redis indisponível bloqueia a operação manual com `503`;
- o frontend consulta o status autenticado para sincronizar contador e tempo;
- mensagens fora de `deliver_before` são canceladas antes do provider.
