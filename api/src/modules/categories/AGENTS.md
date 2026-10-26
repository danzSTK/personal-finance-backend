# Módulo Categories — Instruções Locais

Este módulo gerencia as categorias financeiras de receitas e despesas (sistema e personalizadas pelo usuário).

## Documentação Obrigatória
Antes de planejar ou alterar código neste módulo, leia:
- `docs/specs/` correspondentes às operações de categorias.
- `docs/architecture/module-boundaries.md` — Limites e dívida técnica documentada.

## Regras de Fronteira e Invariantes
- **Integridade Referencial:** Categorias do sistema não podem ser deletadas ou editadas por usuários.
- **Categorias com Transações:** A verificação de transações vinculadas a uma categoria deve respeitar o princípio de limites modulares; use ports de consulta e evite queries invasivas em tabelas de outros agregados.
- **Multi-tenancy:** Categorias personalizadas devem ser obrigatoriamente filtradas pelo `userId` do token JWT.
