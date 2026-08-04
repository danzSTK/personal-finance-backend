---
area: auth
type: index
status: current
related:
  - ../flows/change-password.md
  - ../../specs/auth/change-password/specs/requirements.md
  - ../../specs/auth/change-password/specs/design.md
---

# Alteração de senha autenticada

Esta pasta documenta o funcionamento interno e as decisões duráveis da alteração
de senha. A documentação de consumo HTTP permanece em
[Integração Auth](../../integrations/auth/README.md).

## Documentos

- [Arquitetura](./architecture.md): componentes, autoridades dos dados e
  integrações.
- [Fluxo detalhado](./flow/README.md): caminhos de sucesso, falha da senha
  atual, bloqueios e erros.
- [Decisões arquiteturais](./decisions/README.md): autoridade dos dados,
  concorrência, revogação, outbox e segurança.
- [Chaves Redis](./redis-keys.md): conteúdo, TTL e finalidade de cada chave.
- [Scripts Lua](./lua-scripts.md): contratos atômicos de leitura, barreira e
  substituição da projeção.
- [Notificações](./notifications.md): eventos existentes e escopo ainda
  pendente.

Para uma leitura curta, consulte o
[resumo do fluxo](../flows/change-password.md).
