---
area: accounts
type: decision
status: accepted
issue: 91
related:
  - ../concepts/account.md
  - ../reference/invariants.md
  - ../../specs/accounts/account-templates/specs/requirements.md
  - ./account-template-rollout-preserves-v0-3.md
---

# Identidade Visual De Account Usa Templates

## Decisão

Separar a identidade visual dos dados financeiros da account.

O estado final da account mantém somente `templateId` como referência visual. Cor, ícone e logo pertencem a um `account_template`, inclusive quando a identidade é customizada pelo usuário.

Templates institucionais são globais e compartilhados entre usuários. Selecionar Nubank, Inter ou outra instituição não cria uma cópia institucional por usuário.

## Motivos

- Evitar repetição de identidade institucional em cada account.
- Centralizar mudanças curadas de marca e logo.
- Permitir catálogo institucional sem acoplar a account ao fornecedor do asset.
- Manter uma única abstração para identidade institucional e customizada.

## Consequências

- A API nova recebe um objeto discriminado `template` e retorna `templateId` e os metadados do template.
- Templates institucionais não são personalizáveis nesta fase.
- Templates customizados devem respeitar ownership do usuário autenticado.
- `accounts.color` e `accounts.icon` são exceções temporárias de compatibilidade, não parte do modelo final.

## Fora Desta Decisão

- Reutilização/gerenciamento de templates customizados pelo usuário.
- Upload de logo customizada.
- Lifecycle detalhado de templates customizados.
