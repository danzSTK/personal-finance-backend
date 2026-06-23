---
area: transactions
type: reference
status: draft
related:
  - ../../database/schema.md
  - ./invariants.md
---

# Schema

Esta nota acompanha o schema esperado de transactions conforme a regra de domínio for consolidada.

## Schema Atual/Legado

A tabela `transactions` já existe no banco atual.

Campos principais documentados em [Schema do Banco](../../database/schema.md):

- `id`;
- `user_id`;
- `account_id`;
- `category_id`;
- `amount`;
- `date`;
- `description`;
- `created_at`;
- `updated_at`;
- `is_active`;
- `deactivated_at`.

## Constraints Atuais

- `amount > 0`;
- coerência entre `is_active` e `deactivated_at`;
- vínculo com `users`;
- vínculo com `accounts`;
- vínculo com `categories`.

## Lacunas Para O Modelo Final

Ainda falta decidir se o schema final terá:

- `type`;
- `status`;
- `effective_at`;
- vínculo entre transactions de transferência;
- campo de direção para ajustes;
- campos específicos para recorrência ou parcelamento.
